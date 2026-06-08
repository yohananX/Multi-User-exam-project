import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.supabase_db import select, insert, update, delete
from app.config import settings
from app.schemas.image import ImageOut, ImageCreate, ImageUploadResponse
from app.core.security import get_current_user, require_admin, CurrentUser

router = APIRouter(prefix="/api/images", tags=["images"])


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

    subject_dir = os.path.join(settings.upload_dir, f"class_{class_id}", f"subject_{subject_id}")
    os.makedirs(subject_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    unique_name = f"{next_num:03d}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(subject_dir, unique_name)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

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
        "file_path": file_path,
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

    subject_dir = os.path.join(settings.upload_dir, f"class_{class_id}", f"subject_{subject_id}")
    os.makedirs(subject_dir, exist_ok=True)

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
        file_path = os.path.join(subject_dir, unique_name)

        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        title = f"{cls_name} {subj_name} - {next_num:03d}"

        result = insert("images", {
            "title": title,
            "number": next_num,
            "status": "pending",
            "file_path": file_path,
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

    update("images", {"status": "in_review"}, {"id": f"eq.{image_id}"})

    try:
        output_dir = os.path.join(
            settings.output_dir,
            f"class_{img['class_id']}",
            f"subject_{img['subject_id']}",
        )
        os.makedirs(output_dir, exist_ok=True)
        output_pdf = os.path.join(output_dir, f"img_{img['id']:04d}.pdf")

        process_single_image(img["file_path"], output_pdf)

        update("images", {
            "pdf_path": output_pdf,
            "processed_by": current_user.id,
            "status": "completed",
        }, {"id": f"eq.{image_id}"})

        return {"message": "PDF generated", "id": image_id, "status": "completed"}
    except Exception as e:
        update("images", {"status": "pending"}, {"id": f"eq.{image_id}"})
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


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

        try:
            output_dir = os.path.join(
                settings.output_dir,
                f"class_{img['class_id']}",
                f"subject_{img['subject_id']}",
            )
            os.makedirs(output_dir, exist_ok=True)
            output_pdf = os.path.join(output_dir, f"img_{img['id']:04d}.pdf")

            process_single_image(img["file_path"], output_pdf)

            update("images", {
                "pdf_path": output_pdf,
                "processed_by": current_user.id,
                "status": "completed",
            }, {"id": f"eq.{img['id']}"})
            results.append({"id": img["id"], "status": "completed"})
        except Exception as e:
            results.append({"id": img["id"], "status": f"failed: {str(e)}"})

    return {"results": results}


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
        filters={
            "subject_id": f"eq.{subject_id}",
            "status": "eq.completed",
        },
        order="number.asc",
    )
    images = [i for i in images if i.get("pdf_path")]

    if not images:
        raise HTTPException(status_code=400, detail="No completed images to export")

    output_dir = os.path.join(settings.output_dir, f"class_{subj['class_id']}", f"subject_{subject_id}")
    os.makedirs(output_dir, exist_ok=True)
    output_pdf = os.path.join(output_dir, "combined_exam.pdf")

    pw, ph = A4
    c = rlcanvas.Canvas(output_pdf, pagesize=(pw, ph))
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
        draw_page(i, img["file_path"], img["title"])
        if i < len(images) - 1:
            c.showPage()
    c.save()

    return {"message": "PDF exported", "file_path": output_pdf, "page_count": len(images) + 1}


@router.get("/by-subject/{subject_id}/download-pdf")
def download_subject_pdf(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from fastapi.responses import FileResponse

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    output_pdf = os.path.join(
        settings.output_dir,
        f"class_{subj['class_id']}",
        f"subject_{subject_id}",
        "combined_exam.pdf",
    )
    if not os.path.exists(output_pdf):
        raise HTTPException(status_code=404, detail="PDF not found. Export it first.")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"
    filename = f"{cls_name} - {subj['name']} Exam (Images).pdf"
    return FileResponse(output_pdf, media_type="application/pdf", filename=filename)


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

    resolved_key = api_key.strip() or settings.gemini_api_key or ""
    if not resolved_key:
        raise HTTPException(status_code=400, detail="Gemini API key required")

    image_paths = [i["file_path"] for i in images if i.get("file_path") and os.path.exists(i["file_path"])]
    if not image_paths:
        raise HTTPException(status_code=400, detail="No image files found on disk")

    try:
        text = ocr_images(
            image_paths, resolved_key, subj["name"],
            cls["name"] if cls else f"Class {subj['class_id']}",
            instructions, model_name,
        )
        update("subjects", {"ocr_text": text}, {"id": f"eq.{subject_id}"})
        return {"message": "OCR complete", "ocr_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")


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

    docx_dir = os.path.join(settings.output_dir, f"class_{subj['class_id']}", f"subject_{subject_id}")
    os.makedirs(docx_dir, exist_ok=True)
    docx_path = os.path.join(docx_dir, f"{cls_name} - {subj['name']} Exam.docx")

    ocr_text_to_docx(subj["ocr_text"], subj["name"], cls_name, docx_path)
    update("subjects", {"docx_path": docx_path}, {"id": f"eq.{subject_id}"})

    previews = []
    try:
        pdf_path = os.path.join(docx_dir, "docx_preview.pdf")
        docx_to_pdf(docx_path, pdf_path)
        previews = generate_pdf_previews(pdf_path)
    except Exception:
        pass

    return {"message": "DOCX built", "docx_path": docx_path, "previews": previews}


@router.get("/by-subject/{subject_id}/download-docx")
def download_docx(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from fastapi.responses import FileResponse

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subj.get("docx_path") or not os.path.exists(subj["docx_path"]):
        raise HTTPException(status_code=404, detail="DOCX not found. Build it first.")
    filename = os.path.basename(subj["docx_path"])
    return FileResponse(subj["docx_path"], media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename=filename)


@router.post("/by-subject/{subject_id}/impose")
def impose_exam(
    subject_id: int,
    cols: int = 3,
    rows: int = 2,
    margin_mm: float = 4,
    gap_mm: float = 3,
    page_margin_cm: float = 0.4,
    split_mode: str = "Auto",
    header_pg2: bool = False,
    manual_scale_a: float = 0,
    manual_scale_b: float = 0,
    current_user: CurrentUser = Depends(require_admin),
):
    from app.core.pipeline import process_exam, generate_pdf_previews

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subj.get("docx_path") or not os.path.exists(subj["docx_path"]):
        raise HTTPException(status_code=400, detail="No DOCX found. Build it first.")

    output_dir = os.path.join(settings.output_dir, f"class_{subj['class_id']}", f"subject_{subject_id}")
    os.makedirs(output_dir, exist_ok=True)
    output_pdf = os.path.join(output_dir, "imposed_exam.pdf")

    try:
        result_pdf = process_exam(
            subj["docx_path"],
            cols=int(cols), rows=int(rows),
            margin_mm=float(margin_mm), gap_mm=float(gap_mm),
            page_margin_cm=float(page_margin_cm),
            split_mode=split_mode, header_pg2=bool(header_pg2),
            manual_scale_a=float(manual_scale_a), manual_scale_b=float(manual_scale_b),
        )
        shutil.copy2(result_pdf, output_pdf)
        if os.path.exists(result_pdf) and result_pdf != output_pdf:
            os.unlink(result_pdf)
        update("subjects", {"imposed_pdf_path": output_pdf}, {"id": f"eq.{subject_id}"})

        previews = generate_pdf_previews(output_pdf)
        return {"message": "Imposed PDF generated", "file_path": output_pdf, "previews": previews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impose failed: {str(e)}")


@router.get("/by-subject/{subject_id}/download-imposed")
def download_imposed(
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    from fastapi.responses import FileResponse

    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subj.get("imposed_pdf_path") or not os.path.exists(subj["imposed_pdf_path"]):
        raise HTTPException(status_code=404, detail="Imposed PDF not found. Run impose first.")
    cls = select("classes", filters={"id": f"eq.{subj['class_id']}"}, single=True)
    cls_name = cls["name"] if cls else f"Class {subj['class_id']}"
    filename = f"{cls_name} - {subj['name']} Exam (Imposed).pdf"
    return FileResponse(subj["imposed_pdf_path"], media_type="application/pdf", filename=filename)


@router.delete("/{image_id}")
def delete_image(
    image_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    img = select("images", filters={"id": f"eq.{image_id}"}, single=True)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    if img.get("file_path") and os.path.exists(img["file_path"]):
        os.remove(img["file_path"])
    if img.get("pdf_path") and os.path.exists(img["pdf_path"]):
        os.remove(img["pdf_path"])
    delete("images", {"id": f"eq.{image_id}"})
    return {"message": "Image deleted"}
