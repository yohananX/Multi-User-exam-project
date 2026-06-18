import os
import re
import json
import base64
import uuid
import shutil
import tempfile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from app.supabase_db import select, insert, update, delete
from app.supabase_db import storage_upload, storage_download, storage_signed_url, storage_delete, storage_list
from app.config import settings
from app.schemas.image import ImageOut, ImageUploadResponse
from app.core.security import get_current_user, require_admin, CurrentUser

router = APIRouter(prefix="/api/images", tags=["images"])

UPLOAD_PREFIX = "uploads"
OUTPUT_PREFIX = "outputs"


def _img_storage_path(class_id: int, subject_id: int, filename: str) -> str:
    return f"{UPLOAD_PREFIX}/class_{class_id}/subject_{subject_id}/{filename}"


def _output_storage_path(class_id: int, subject_id: int, filename: str) -> str:
    return f"{OUTPUT_PREFIX}/class_{class_id}/subject_{subject_id}/{filename}"


def _temp_download(storage_path: str) -> str:
    """Download a file from Storage to a temp file. Returns the temp path."""
    data = storage_download(storage_path)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(storage_path)[1])
    tmp.write(data)
    tmp.close()
    return tmp.name


def _list_output_prefix(class_id: int, subject_id: int) -> str:
    return f"{OUTPUT_PREFIX}/class_{class_id}/subject_{subject_id}/"


# ─── List / Query ───────────────────────────────────────────────────

@router.get("/", response_model=list[ImageOut])
def list_images(
    class_id: int | None = None,
    subject_id: int | None = None,
    status: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == "teacher":
        assigned = select("teacher_assignments", filters={"teacher_id": f"eq.{current_user.id}"})
        if not assigned:
            return []
        sids = [a["subject_id"] for a in assigned]
        filters = {"subject_id": f"in.({','.join(str(s) for s in sids)})"}
    else:
        filters = {}
    if class_id:
        filters["class_id"] = f"eq.{class_id}"
    if subject_id:
        filters["subject_id"] = f"eq.{subject_id}"
    if status:
        filters["status"] = f"eq.{status}"
    return select("images", filters=filters or None, order="created_at.desc")


@router.get("/by-subject/{subject_id}", response_model=list[ImageOut])
def list_images_by_subject(
    subject_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == "teacher":
        assigned = select(
            "teacher_assignments",
            filters={"teacher_id": f"eq.{current_user.id}", "subject_id": f"eq.{subject_id}"},
            single=True,
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Not assigned to this subject")
    return select("images", filters={"subject_id": f"eq.{subject_id}"}, order="number.asc")


# ─── Upload ─────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_image(
    class_id: int = Form(...),
    subject_id: int = Form(...),
    title: str = Form(""),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == "teacher":
        assigned = select(
            "teacher_assignments",
            filters={
                "teacher_id": f"eq.{current_user.id}",
                "class_id": f"eq.{class_id}",
                "subject_id": f"eq.{subject_id}",
            },
            single=True,
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Not assigned to this class/subject")

    existing = select("images", filters={"subject_id": f"eq.{subject_id}"}, order="number.desc", limit=1)
    next_num = (existing[0]["number"] + 1) if existing else 1

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    unique_name = f"{next_num:03d}_{uuid.uuid4().hex[:8]}{ext}"
    storage_path = _img_storage_path(class_id, subject_id, unique_name)

    content = await file.read()
    storage_upload(storage_path, content, file.content_type or "image/jpeg")

    if not title:
        cls = select("classes", filters={"id": f"eq.{class_id}"}, single=True)
        subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
        cls_name = cls["name"] if cls else f"Class{class_id}"
        subj_name = subj["name"] if subj else f"Subject{subject_id}"
        title = f"{cls_name} {subj_name} - {next_num:03d}"

    result = insert("images", {
        "title": title,
        "number": next_num,
        "status": "pending",
        "file_path": storage_path,
        "class_id": class_id,
        "subject_id": subject_id,
        "uploaded_by": current_user.id,
    })
    img = result[0] if isinstance(result, list) else result
    return {
        "id": img["id"],
        "title": img["title"],
        "number": img["number"],
        "status": img["status"],
        "file_path": img.get("file_path"),
        "message": f"Uploaded as {next_num:03d}",
    }


@router.post("/upload-multiple")
async def upload_multiple(
    class_id: int = Form(...),
    subject_id: int = Form(...),
    files: list[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == "teacher":
        assigned = select(
            "teacher_assignments",
            filters={
                "teacher_id": f"eq.{current_user.id}",
                "class_id": f"eq.{class_id}",
                "subject_id": f"eq.{subject_id}",
            },
            single=True,
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Not assigned")

    cls = select("classes", filters={"id": f"eq.{class_id}"}, single=True)
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    cls_name = cls["name"] if cls else f"Class{class_id}"
    subj_name = subj["name"] if subj else f"Subject{subject_id}"

    results = []
    for file in files:
        existing = select("images", filters={"subject_id": f"eq.{subject_id}"}, order="number.desc", limit=1)
        next_num = (existing[0]["number"] + 1) if existing else 1

        ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
        unique_name = f"{next_num:03d}_{uuid.uuid4().hex[:8]}{ext}"
        storage_path = _img_storage_path(class_id, subject_id, unique_name)

        content = await file.read()
        storage_upload(storage_path, content, file.content_type or "image/jpeg")

        title = f"{cls_name} {subj_name} - {next_num:03d}"

        result = insert("images", {
            "title": title,
            "number": next_num,
            "status": "pending",
            "file_path": storage_path,
            "class_id": class_id,
            "subject_id": subject_id,
            "uploaded_by": current_user.id,
        })
        img = result[0] if isinstance(result, list) else result
        results.append({
            "id": img["id"],
            "title": img["title"],
            "number": img["number"],
            "status": img["status"],
        })

    return {"message": f"Uploaded {len(results)} image(s)", "images": results}


# ─── Status / Convert ──────────────────────────────────────────────

@router.post("/{image_id}/mark-in-review")
def mark_in_review(
    image_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    update("images", {"status": "in_review"}, {"id": f"eq.{image_id}"})
    return {"message": "Marked as in review", "id": image_id, "status": "in_review"}


@router.post("/{image_id}/convert")
def convert_to_pdf(
    image_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from app.core.pipeline import process_single_image

    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if not img.get("file_path"):
        raise HTTPException(status_code=400, detail="No file path for this image")

    update("images", {"status": "in_review"}, {"id": f"eq.{image_id}"})

    tmp_img = None
    tmp_pdf = None
    try:
        tmp_img = _temp_download(img["file_path"])
        tmp_pdf = tempfile.mktemp(suffix=".pdf")
        process_single_image(tmp_img, tmp_pdf)

        storage_path = _output_storage_path(img["class_id"], img["subject_id"], f"img_{img['id']:04d}.pdf")
        with open(tmp_pdf, "rb") as f:
            storage_upload(storage_path, f.read(), "application/pdf")

        update("images", {
            "pdf_path": storage_path,
            "processed_by": current_user.id,
            "status": "completed",
        }, {"id": f"eq.{image_id}"})

        return {"message": "PDF generated", "id": image_id, "status": "completed"}
    except Exception as e:
        update("images", {"status": "pending"}, {"id": f"eq.{image_id}"})
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        for p in (tmp_img, tmp_pdf):
            if p and os.path.exists(p):
                os.unlink(p)


@router.post("/by-subject/{subject_id}/convert-all")
def convert_all_subject_to_pdf(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    images = select(
        "images",
        filters={"subject_id": f"eq.{subject_id}", "status": f"in.(pending,in_review)"},
    )
    if not images:
        raise HTTPException(status_code=400, detail="No pending images for this subject")

    results = []
    for img in images:
        update("images", {"status": "in_review"}, {"id": f"eq.{img['id']}"})
        tmp_img = None
        tmp_pdf = None
        try:
            tmp_img = _temp_download(img["file_path"])
            tmp_pdf = tempfile.mktemp(suffix=".pdf")
            process_single_image(tmp_img, tmp_pdf)

            storage_path = _output_storage_path(img["class_id"], img["subject_id"], f"img_{img['id']:04d}.pdf")
            with open(tmp_pdf, "rb") as f:
                storage_upload(storage_path, f.read(), "application/pdf")

            update("images", {
                "pdf_path": storage_path,
                "processed_by": current_user.id,
                "status": "completed",
            }, {"id": f"eq.{img['id']}"})
            results.append({"id": img["id"], "status": "completed"})
        except Exception as e:
            results.append({"id": img["id"], "status": f"failed: {str(e)}"})
        finally:
            for p in (tmp_img, tmp_pdf):
                if p and os.path.exists(p):
                    os.unlink(p)

    return {"results": results}


# ─── Export Combined PDF ────────────────────────────────────────────

@router.post("/by-subject/{subject_id}/export-pdf")
def export_subject_pdf(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as rlcanvas
    from reportlab.lib.units import mm
    from PIL import Image

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)

    images = select(
        "images",
        filters={"subject_id": f"eq.{subject_id}", "status": "eq.completed"},
        order="number.asc",
    )
    images = [i for i in images if i.get("pdf_path")]

    if not images:
        raise HTTPException(status_code=400, detail="No completed images to export")

    tmp_files = []
    try:
        # Download all image PDFs to temp files
        image_paths = []
        for img in images:
            p = _temp_download(img["pdf_path"])
            image_paths.append(p)
            tmp_files.append(p)

        tmp_output = tempfile.mktemp(suffix=".pdf")
        tmp_files.append(tmp_output)

        pw, ph = A4
        c = rlcanvas.Canvas(tmp_output, pagesize=(pw, ph))
        margin = 20 * mm
        cls_name = cls["name"] if cls else f"Class {subj['class_id']}"

        def draw_cover():
            c.setFont("Helvetica-Bold", 24)
            c.drawCentredString(pw / 2, ph - 80 * mm, "GRACE HOUSE INTERNATIONAL SCHOOL")
            c.setFont("Helvetica", 16)
            c.drawCentredString(pw / 2, ph - 100 * mm, "THIRD TERMINAL EXAMINATION")
            c.setFont("Helvetica", 14)
            c.drawCentredString(pw / 2, ph - 120 * mm, "(2025/2026 SESSION)")
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(pw / 2, ph - 155 * mm, f"{cls_name} - {subj['name']}")
            c.setFont("Helvetica", 12)
            c.drawCentredString(pw / 2, ph - 175 * mm, f"{len(images)} question(s)")
            c.setFont("Helvetica", 10)
            c.drawCentredString(pw / 2, 30 * mm, "Prepared by Examination Platform")
            c.showPage()

        def draw_page(img_num: int, image_path: str, page_label: str):
            pil_img = Image.open(image_path)
            img_w, img_h = pil_img.size
            avail_w = pw - 2 * margin
            avail_h = ph - 2 * margin - 15 * mm
            scale = min(avail_w / img_w, avail_h / img_h)
            dw = img_w * scale
            dh = img_h * scale
            x = (pw - dw) / 2
            y = (ph - dh - 15 * mm) / 2 + 5 * mm
            c.setFont("Helvetica", 9)
            c.drawCentredString(pw / 2, ph - 10 * mm, page_label)
            c.drawImage(image_path, x, y, width=dw, height=dh, preserveAspectRatio=True)
            c.setFont("Helvetica", 8)
            c.drawCentredString(pw / 2, 12 * mm, f"Page {img_num + 1}")

        draw_cover()
        for i, img in enumerate(images):
            draw_page(i, image_paths[i], img["title"])
            if i < len(images) - 1:
                c.showPage()
        c.save()

        storage_path = _output_storage_path(subj["class_id"], subject_id, "combined_exam.pdf")
        with open(tmp_output, "rb") as f:
            storage_upload(storage_path, f.read(), "application/pdf")

        return {"message": "PDF exported", "file_path": storage_path, "page_count": len(images) + 1}
    finally:
        for p in set(tmp_files):
            if p and os.path.exists(p):
                os.unlink(p)


# ─── Download ───────────────────────────────────────────────────────

@router.get("/by-subject/{subject_id}/download-pdf")
def download_subject_pdf(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"
    storage_path = _output_storage_path(subj["class_id"], subject_id, "combined_exam.pdf")
    try:
        storage_download(storage_path)  # just check exists
    except Exception:
        raise HTTPException(status_code=404, detail="PDF not found. Export it first.")
    url = storage_signed_url(storage_path)
    filename = f"{cls_name} - {subj['name']} Exam (Images).pdf"
    return {"url": url, "filename": filename}


# ─── OCR ────────────────────────────────────────────────────────────

@router.post("/by-subject/{subject_id}/ocr")
def run_ocr(
    subject_id: int,
    api_key: str = "",
    instructions: str = "",
    model_name: str = "gemini-2.5-flash",
    current_user: CurrentUser = Depends(require_admin),
):
    from app.core.pipeline import ocr_images

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)

    images = select("images", filters={"subject_id": f"eq.{subject_id}"}, order="number.asc")
    if not images:
        raise HTTPException(status_code=400, detail="No images for this subject")

    resolved_key = api_key.strip() or settings.openrouter_api_key or settings.gemini_api_key or ""
    if not resolved_key:
        raise HTTPException(status_code=400, detail="No API key configured (set OPENROUTER_API_KEY or GEMINI_API_KEY in .env)")

    tmp_files = []
    try:
        image_paths = []
        for img in images:
            if not img.get("file_path"):
                continue
            p = _temp_download(img["file_path"])
            image_paths.append(p)
            tmp_files.append(p)

        if not image_paths:
            raise HTTPException(status_code=400, detail="No image files found")

        text = ocr_images(
            image_paths, resolved_key, subj["name"],
            cls["name"] if cls else f"Class {subj['class_id']}",
            instructions, model_name,
        )
        update("subjects", {"ocr_text": text}, {"id": f"eq.{subject_id}"})
        return {"message": "OCR complete", "ocr_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
    finally:
        for p in tmp_files:
            if p and os.path.exists(p):
                os.unlink(p)


@router.get("/by-subject/{subject_id}/ocr-text")
def get_ocr_text(
    subject_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"ocr_text": subj.get("ocr_text") or ""}


@router.put("/by-subject/{subject_id}/ocr-text")
def update_ocr_text(
    subject_id: int,
    data: dict,
    current_user: CurrentUser = Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    update("subjects", {"ocr_text": data.get("ocr_text", "")}, {"id": f"eq.{subject_id}"})
    return {"message": "OCR text updated"}


# ─── Build DOCX ─────────────────────────────────────────────────────

@router.post("/by-subject/{subject_id}/build-docx")
def build_docx(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from app.core.pipeline import ocr_text_to_docx, docx_to_pdf, generate_pdf_previews

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subj.get("ocr_text"):
        raise HTTPException(status_code=400, detail="No OCR text. Run OCR first.")

    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"

    tmp_docx = None
    tmp_pdf = None
    try:
        tmp_docx = tempfile.mktemp(suffix=".docx")
        ocr_text_to_docx(subj["ocr_text"], subj["name"], cls_name, tmp_docx)

        docx_storage_path = f"generated/subject_{subject_id}/exam.docx"
        try:
            with open(tmp_docx, "rb") as f:
                storage_upload(docx_storage_path, f.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            update("subjects", {"docx_path": docx_storage_path}, {"id": f"eq.{subject_id}"})
        except Exception as e:
            print(f"[images.py] Error saving DOCX to generated/: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save DOCX: {e}")

        previews = []
        try:
            tmp_pdf = tempfile.mktemp(suffix=".pdf")
            docx_to_pdf(tmp_docx, tmp_pdf)
            previews = generate_pdf_previews(tmp_pdf)
        except Exception:
            pass

        if previews:
            try:
                preview_paths = []
                for i, b64 in enumerate(previews):
                    png_data = base64.b64decode(b64)
                    p = f"generated/subject_{subject_id}/docx_preview_{i}.png"
                    storage_upload(p, png_data, "image/png")
                    preview_paths.append(p)
                update("subjects", {"docx_preview_paths": preview_paths}, {"id": f"eq.{subject_id}"})
            except Exception as e:
                print(f"[images.py] Warning: failed to save DOCX previews: {e}")

        return {"message": "DOCX built", "docx_path": docx_storage_path, "previews": previews}
    finally:
        for p in (tmp_docx, tmp_pdf):
            if p and os.path.exists(p):
                os.unlink(p)


# ─── Download DOCX ──────────────────────────────────────────────────

@router.get("/by-subject/{subject_id}/download-docx")
def download_docx(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    storage_path = subj.get("docx_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="DOCX not found. Build it first.")
    try:
        storage_download(storage_path)  # just check exists
    except Exception:
        raise HTTPException(status_code=404, detail="DOCX file missing from storage.")
    url = storage_signed_url(storage_path)
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"
    filename = f"{cls_name} - {subj['name']} Exam.docx"
    return {"url": url, "filename": filename}


# ─── Impose ─────────────────────────────────────────────────────────

@router.post("/by-subject/{subject_id}/impose")
def impose_exam(
    subject_id: int,
    cols: int = 3,
    rows: int = 2,
    margin_mm: float = 2.5,
    gap_mm: float = 2,
    page_margin_cm: float = 0.25,
    split_mode: str = "Auto",
    header_pg2: bool = False,
    manual_scale_a: float = 0,
    manual_scale_b: float = 0,
    scale_a: int = 100,
    scale_b: int = 100,
    current_user: CurrentUser = Depends(require_admin),
):
    from app.core.pipeline import process_exam, impose_from_text, generate_pdf_previews

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    ocr_text = subj.get("ocr_text", "") or ""
    storage_path = subj.get("docx_path")

    tmp_docx = None
    tmp_files = []
    try:
        # Prefer text-based pipeline (no LibreOffice, no DOCX) if OCR text exists
        if ocr_text.strip():
            result_pdf = tempfile.mktemp(suffix=".pdf")
            impose_from_text(
                ocr_text, result_pdf,
                cols=int(cols), rows=int(rows),
                margin_mm=float(margin_mm), gap_mm=float(gap_mm),
            )
            tmp_files.append(result_pdf)
        elif storage_path:
            tmp_docx = _temp_download(storage_path)
            tmp_files.append(tmp_docx)

            result_pdf = process_exam(
                tmp_docx,
                cols=int(cols), rows=int(rows),
                margin_mm=float(margin_mm), gap_mm=float(gap_mm),
                page_margin_cm=float(page_margin_cm),
                split_mode=split_mode, header_pg2=bool(header_pg2),
                manual_scale_a=float(manual_scale_a), manual_scale_b=float(manual_scale_b),
                scale_a=scale_a, scale_b=scale_b,
            )
            tmp_files.append(result_pdf)
        else:
            raise HTTPException(status_code=400, detail="No OCR text or DOCX found. Run OCR or build DOCX first.")

        imposed_storage_path = f"generated/subject_{subject_id}/imposed.pdf"
        try:
            with open(result_pdf, "rb") as f:
                storage_upload(imposed_storage_path, f.read(), "application/pdf")
            update("subjects", {
                "imposed_pdf_path": imposed_storage_path,
                "status": "completed",
            }, {"id": f"eq.{subject_id}"})
        except Exception as e:
            print(f"[images.py] Error saving imposed PDF: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save imposed PDF: {e}")

        previews = []
        try:
            previews = generate_pdf_previews(result_pdf)
        except Exception:
            pass

        if previews:
            try:
                preview_paths = []
                for i, b64 in enumerate(previews):
                    png_data = base64.b64decode(b64)
                    p = f"generated/subject_{subject_id}/impose_preview_{i}.png"
                    storage_upload(p, png_data, "image/png")
                    preview_paths.append(p)
                update("subjects", {"impose_preview_paths": preview_paths}, {"id": f"eq.{subject_id}"})
            except Exception as e:
                print(f"[images.py] Warning: failed to save impose previews: {e}")

        return {"message": "Imposed PDF generated", "file_path": imposed_storage_path, "previews": previews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impose failed: {str(e)}")
    finally:
        for p in tmp_files:
            if p and os.path.exists(p):
                os.unlink(p)


# ─── Download Imposed ───────────────────────────────────────────────

@router.get("/by-subject/{subject_id}/download-imposed")
def download_imposed(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    storage_path = subj.get("imposed_pdf_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="Imposed PDF not found. Run impose first.")
    try:
        storage_download(storage_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Imposed PDF file missing from storage.")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"
    url = storage_signed_url(storage_path)
    filename = f"{cls_name} - {subj['name']} Exam (Imposed).pdf"
    return {"url": url, "filename": filename}


# ─── View Images ────────────────────────────────────────────────────

@router.get("/{image_id}/file")
def view_image_file(
    image_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if not img.get("file_path"):
        raise HTTPException(status_code=404, detail="No file for this image")
    url = storage_signed_url(img["file_path"])
    return RedirectResponse(url=url)


@router.get("/{image_id}/pdf")
def view_image_pdf(
    image_id: int,
    current_user: CurrentUser = Depends(get_current_user),
):
    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if not img.get("pdf_path"):
        raise HTTPException(status_code=404, detail="No PDF for this image. Convert it first.")
    url = storage_signed_url(img["pdf_path"])
    return RedirectResponse(url=url)


# ─── Delete ─────────────────────────────────────────────────────────

@router.delete("/{image_id}")
def delete_image(
    image_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if img.get("file_path"):
        try:
            storage_delete(img["file_path"])
        except Exception:
            pass
    if img.get("pdf_path"):
        try:
            storage_delete(img["pdf_path"])
        except Exception:
            pass
    delete("images", {"id": f"eq.{image_id}"})
    return {"message": "Image deleted"}
