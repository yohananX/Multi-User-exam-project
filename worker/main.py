"""
Worker: polls Supabase for pending documents, processes them via the pipeline,
and uploads results back to Supabase Storage.

Usage:
  python worker/main.py                  # single poll cycle
  python worker/main.py --watch          # poll every 60s
  python worker/main.py --watch --interval 30

Requires .env with:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
"""

import os
import sys
import time
import json
import tempfile
import argparse
from pathlib import Path
from urllib.parse import urljoin

import httpx

# Add backend to path so we can reuse pipeline + supabase_db
BACKEND_DIR = str(Path(__file__).resolve().parent.parent / "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")
os.environ.setdefault("GEMINI_API_KEY", "")

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}
STORAGE_BUCKET = "exam-files"  # same bucket for uploads + generated

client = httpx.Client(timeout=60)


# ─── Supabase helpers ───────────────────────────────────────────────

def _rest(path: str) -> str:
    return urljoin(f"{SUPABASE_URL}/rest/v1/", path.lstrip("/"))

def _storage(path: str) -> str:
    return urljoin(f"{SUPABASE_URL}/storage/v1/", path.lstrip("/"))

def select(table: str, *, filters: dict | None = None, order: str | None = None, limit: int | None = None):
    url = _rest(table)
    params = {"select": "*"}
    if filters:
        for k, v in filters.items():
            params[k] = f"eq.{v}"
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    r = client.get(url, headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()

def update(table: str, data: dict, filters: dict):
    url = _rest(table)
    params = {}
    for k, v in filters.items():
        params[k] = f"eq.{v}"
    r = client.patch(url, headers=HEADERS, params=params, json=data)
    r.raise_for_status()

def storage_upload(storage_path: str, data: bytes, content_type: str = "application/octet-stream"):
    url = _storage(f"object/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    h = {**HEADERS, "Content-Type": content_type}
    r = client.post(url, headers=h, content=data)
    if r.status_code == 409:
        # Object already exists — overwrite
        r = client.put(url, headers=h, content=data)
    r.raise_for_status()
    return r.json()

def storage_download(storage_path: str) -> bytes:
    url = _storage(f"object/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    r = client.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.content


# ─── Pipeline imports ──────────────────────────────────────────────

try:
    from app.core.pipeline import ocr_images, ocr_text_to_docx, process_exam, generate_pdf_previews
    HAS_PIPELINE = True
except ImportError as e:
    print(f"[worker] WARNING: pipeline import failed: {e}", file=sys.stderr)
    HAS_PIPELINE = False


# ─── Processing logic ──────────────────────────────────────────────

def process_subject(subject_id: int):
    """Run OCR + DOCX + imposition for a subject. Returns True on success."""
    print(f"[worker] Processing subject {subject_id}...")

    # Fetch subject + class info
    subj = select("subjects", filters={"id": subject_id}, limit=1)
    if not subj:
        print(f"[worker] Subject {subject_id} not found")
        return False
    subj = subj[0]

    cls = select("classes", filters={"id": subj["class_id"]}, limit=1)
    class_name = cls[0]["name"] if cls else "Unknown"

    # Find all pending images for this subject
    images = select("images", filters={"subject_id": subject_id, "status": "pending"}, order="number")
    if not images:
        print(f"[worker] No pending images for subject {subject_id}")
        return False

    # 1. Download images
    with tempfile.TemporaryDirectory() as tmpdir:
        image_paths = []
        for img in images:
            if not img.get("file_path"):
                continue
            local_path = os.path.join(tmpdir, f"{img['number']:03d}.jpg")
            try:
                data = storage_download(img["file_path"])
                with open(local_path, "wb") as f:
                    f.write(data)
                image_paths.append(local_path)
            except Exception as e:
                print(f"[worker] Download failed for {img['file_path']}: {e}")

        if not image_paths:
            print(f"[worker] No images could be downloaded for subject {subject_id}")
            return False

        # 2. OCR
        print(f"[worker] Running OCR on {len(image_paths)} images...")
        try:
            instructions = f"Answer all questions in {subj['name']}"
            if subj.get("instructions"):
                instructions = subj["instructions"]
            ocr_text = ocr_images(image_paths, GEMINI_API_KEY, subj["name"], class_name, instructions)
        except Exception as e:
            print(f"[worker] OCR failed: {e}")
            return False

        # 3. Save OCR text to subject
        update("subjects", {"ocr_text": ocr_text}, {"id": subject_id})

        # 4. Build DOCX
        print(f"[worker] Building DOCX...")
        try:
            docx_path = os.path.join(tmpdir, f"exam_{subject_id}.docx")
            ocr_text_to_docx(ocr_text, subj["name"], class_name, docx_path)
        except Exception as e:
            print(f"[worker] DOCX build failed: {e}")
            return False

        # 5. Upload DOCX
        with open(docx_path, "rb") as f:
            docx_data = f.read()
        docx_storage_path = f"generated/subject_{subject_id}/exam.docx"
        try:
            storage_upload(docx_storage_path, docx_data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        except Exception as e:
            print(f"[worker] DOCX upload failed: {e}")
            return False

        update("subjects", {"docx_path": docx_storage_path, "status": "docx_ready"}, {"id": subject_id})

        # 6. Impose → PDF
        print(f"[worker] Imposing PDF...")
        try:
            imposed_path = os.path.join(tmpdir, f"imposed_{subject_id}.pdf")
            process_exam(
                docx_path,
                imposed_path,
                cols=3, rows=2, margin_mm=4, gap_mm=3,
                page_margin_cm=0.4, split_mode="Auto", header_pg2=False,
                manual_scale_a=0, manual_scale_b=0,
            )
        except Exception as e:
            print(f"[worker] Imposition failed: {e}")
            # Still mark OCR/DOCX as done
            return False

        # 7. Upload imposed PDF
        with open(imposed_path, "rb") as f:
            pdf_data = f.read()
        pdf_storage_path = f"generated/subject_{subject_id}/imposed.pdf"
        try:
            storage_upload(pdf_storage_path, pdf_data, "application/pdf")
        except Exception as e:
            print(f"[worker] PDF upload failed: {e}")
            return False

        update("subjects", {"imposed_pdf_path": pdf_storage_path, "status": "completed"}, {"id": subject_id})

        # 8. Generate previews
        try:
            previews = generate_pdf_previews(imposed_path)
            previews_json = json.dumps(previews)
            update("subjects", {"previews_json": previews_json}, {"id": subject_id})
        except Exception as e:
            print(f"[worker] Preview generation failed (non-fatal): {e}")

        # 9. Mark images as completed
        for img in images:
            update("images", {"status": "completed"}, {"id": img["id"]})

    print(f"[worker] Subject {subject_id} completed successfully!")
    return True


def poll():
    print(f"[worker] Polling for pending subjects...")
    subjects = select("subjects", filters={"status": "ocr_pending"})
    for subj in subjects:
        process_subject(subj["id"])


def main():
    parser = argparse.ArgumentParser(description="Exam processing worker")
    parser.add_argument("--watch", action="store_true", help="Poll continuously")
    parser.add_argument("--interval", type=int, default=60, help="Poll interval in seconds")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("[worker] ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        sys.exit(1)

    if not GEMINI_API_KEY:
        print("[worker] ERROR: GEMINI_API_KEY must be set", file=sys.stderr)
        sys.exit(1)

    if not HAS_PIPELINE:
        print("[worker] ERROR: Pipeline module not available. Run from project root.", file=sys.stderr)
        print(f"[worker] PYTHONPATH includes: {BACKEND_DIR}", file=sys.stderr)
        sys.exit(1)

    if args.watch:
        print(f"[worker] Watch mode — polling every {args.interval}s")
        while True:
            try:
                poll()
            except Exception as e:
                print(f"[worker] Poll cycle error: {e}", file=sys.stderr)
            time.sleep(args.interval)
    else:
        poll()


if __name__ == "__main__":
    main()
