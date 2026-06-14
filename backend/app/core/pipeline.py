import os
import re
import shutil
import subprocess
import tempfile
import glob
import base64
import io
from pathlib import Path
from typing import Optional

from PIL import Image
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4, landscape as rl_landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


DOCX_TEMPLATE_HEADER = """**GRACE HOUSE INTERNATIONAL SCHOOL**
**THIRD TERMINAL EXAMINATION**
**(2025/2026 SESSION)**
"""

OCR_PROMPT_TEMPLATE = """You are an expert academic typist and OCR specialist. Transcribe the handwritten examination sheets from the provided images.

OUTPUT FORMAT — Follow this structure exactly, no deviations:

1. Start with these exact three header lines:
**GRACE HOUSE INTERNATIONAL SCHOOL**
**THIRD TERMINAL EXAMINATION**
**(2025/2026 SESSION)**

2. Metadata line (NOT bold, no markdown):
SUBJECT: {subject}      CLASS: {class_name}

3. Instructions line (bold):
**INSTRUCTIONS: {instructions}**

4. Leave one blank line, then section headers in ALL CAPS BOLD:
**SECTION A (MULTIPLE CHOICE)**
Leave one blank line before and after section headers.

5. Multiple choice: Put options on the SAME LINE as the question, separated by single spaces.
Use lowercase letters in parentheses: (a) (b) (c) (d)
Example: 1. Which game uses a racket and ball? (a) Football (b) Table Tennis (c) Swimming

6. Theory questions: Use sub-letters indented under the question number.
Example:
1 a) What is noise pollution?
   b) List 5 causes of noise pollution.

7. Fix obvious spelling errors based on context (e.g., "fether" → "father", "freg" → "frog").

8. Return ONLY the formatted text. No explanations, no greetings, no extra commentary."""


def ocr_images(images: list[str], api_key: str, subject: str, class_name: str,
               instructions: str = "", model_name: str = "gemini-2.5-flash") -> str:
    """Send images to Gemini, return formatted OCR text."""
    from google import genai
    prompt = OCR_PROMPT_TEMPLATE.format(
        subject=subject, class_name=class_name,
        instructions=instructions or "Answer Section A and any TWO questions from Section B.",
    )
    client = genai.Client(api_key=api_key)
    contents = [prompt]
    for img_path in images:
        img = Image.open(img_path)
        contents.append(img)
    response = client.models.generate_content(model=model_name, contents=contents)
    return response.text


def ocr_text_to_docx(text: str, subject: str, class_name: str, output_path: str) -> str:
    """Parse OCR text (with **bold** markers) and build a formatted DOCX.
    Mirrors the OCR text structure faithfully — headers get centered/bold treatment,
    everything else follows the original line structure with no extra spacing."""
    doc = Document()
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(10)
    style.paragraph_format.space_before = Pt(0)
    style.paragraph_format.space_after = Pt(0)
    style.paragraph_format.line_spacing = 1.0

    lines = text.strip().split('\n')
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        is_bold = re.match(r'\*\*(.+?)\*\*', stripped)
        is_section_header = re.match(r'\*\*SECTION\s', stripped, re.I) or \
                            re.match(r'SECTION\s', stripped, re.I)

        if not stripped:
            i += 1
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0

        if i < 3 and not is_section_header:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            txt = is_bold.group(1) if is_bold else stripped
            run = p.add_run(txt)
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(10)
        elif is_section_header:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            clean = stripped.replace('**', '')
            run = p.add_run(clean.upper())
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(10)
        elif stripped.startswith('**INSTRUCTIONS'):
            run = p.add_run(stripped.replace('**', ''))
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(10)
        elif stripped.startswith('SUBJECT:'):
            run = p.add_run(stripped)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(10)
        else:
            parts = re.split(r'(\*\*.*?\*\*)', stripped)
            for part in parts:
                bm = re.match(r'\*\*(.*?)\*\*', part)
                if bm:
                    run = p.add_run(bm.group(1))
                    run.bold = True
                else:
                    run = p.add_run(part)
                run.font.name = 'Times New Roman'
                run.font.size = Pt(10)

        i += 1

    doc.save(output_path)
    return output_path


def clone_run_format(src_run, dst_run):
    dst_run.bold = src_run.bold
    dst_run.italic = src_run.italic
    dst_run.underline = src_run.underline
    dst_run.font.strike = src_run.font.strike
    dst_run.font.superscript = src_run.font.superscript
    dst_run.font.subscript = src_run.font.subscript
    if src_run.font.name:
        dst_run.font.name = src_run.font.name
    if src_run.font.size:
        dst_run.font.size = src_run.font.size
    if src_run.font.color and src_run.font.color.rgb:
        try:
            dst_run.font.color.rgb = src_run.font.color.rgb
        except Exception:
            pass


def build_docx_from_ocr(
    text: str,
    subject: str,
    class_name: str,
    output_path: str,
    font_name: str = "Times New Roman",
    font_size_pt: int = 10,
) -> str:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = font_name
    style.font.size = Pt(font_size_pt)
    style.paragraph_format.space_before = Pt(0)
    style.paragraph_format.space_after = Pt(0)
    style.paragraph_format.line_spacing = 1.0

    lines = text.strip().split("\n")
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        is_bold = re.match(r"\*\*(.+?)\*\*", stripped)
        is_section_header = re.match(r"\*\*SECTION\s", stripped, re.I) or re.match(
            r"SECTION\s", stripped, re.I
        )

        if not stripped:
            i += 1
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0

        if i < 3 and not is_section_header:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            txt = is_bold.group(1) if is_bold else stripped
            run = p.add_run(txt)
            run.bold = True
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
        elif is_section_header:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            clean = stripped.replace("**", "")
            run = p.add_run(clean.upper())
            run.bold = True
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
        elif stripped.startswith("**INSTRUCTIONS"):
            run = p.add_run(stripped.replace("**", ""))
            run.bold = True
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
        elif stripped.startswith("SUBJECT:"):
            run = p.add_run(stripped)
            run.font.name = font_name
            run.font.size = Pt(font_size_pt)
        else:
            parts = re.split(r"(\*\*.*?\*\*)", stripped)
            for part in parts:
                bm = re.match(r"\*\*(.*?)\*\*", part)
                if bm:
                    run = p.add_run(bm.group(1))
                    run.bold = True
                else:
                    run = p.add_run(part)
                run.font.name = font_name
                run.font.size = Pt(font_size_pt)

        i += 1

    doc.save(output_path)
    return output_path


def find_section_boundary(paragraphs):
    for i, p in enumerate(paragraphs):
        if re.match(r"(?i)^section\s+b", p.text.strip()):
            return i
    return None


def build_compact_docx(paragraphs, ranges, page_w_cm, page_h_cm, margin_cm, output_path):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(page_w_cm)
    sec.page_height = Cm(page_h_cm)
    for m in ["left_margin", "right_margin", "top_margin", "bottom_margin"]:
        setattr(sec, m, Cm(margin_cm))
    doc.styles["Normal"].font.size = Pt(12)

    for rng_start, rng_end in ranges:
        for pi in range(rng_start, rng_end):
            src = paragraphs[pi]
            text = src.text
            if not text.strip() and not src.runs:
                doc.add_paragraph("")
                continue
            is_hdr = pi < 3
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if is_hdr else src.alignment
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            for run in src.runs:
                r = p.add_run(run.text)
                clone_run_format(run, r)
                if is_hdr:
                    r.bold = True
                if r.font.size is None:
                    r.font.size = Pt(12)
            if not src.runs and text.strip():
                r = p.add_run(text)
                if is_hdr:
                    r.bold = True
                r.font.size = Pt(12)

    doc.save(output_path)
    return output_path


def modify_docx_font_sizes(docx_path, scale_factor, output_path=None):
    if output_path is None:
        output_path = docx_path
    doc = Document(docx_path)
    for p in doc.paragraphs:
        for r in p.runs:
            if r.font.size:
                r.font.size = Pt(int(r.font.size.pt * scale_factor))
    for sname in ["Normal", "Heading 1", "Heading 2", "Heading 3", "Title"]:
        if sname in doc.styles:
            s = doc.styles[sname]
            if s.font and s.font.size:
                s.font.size = Pt(int(s.font.size.pt * scale_factor))
    doc.save(output_path)
    return output_path


def docx_to_pdf(docx_path, output_pdf, timeout=120):
    outdir = os.path.dirname(output_pdf) or "."
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", outdir, docx_path],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice failed: {result.stderr}")
    base = Path(docx_path).stem
    expected = os.path.join(outdir, f"{base}.pdf")
    if os.path.exists(expected):
        if expected != output_pdf:
            shutil.move(expected, output_pdf)
        return output_pdf
    candidates = glob.glob(os.path.join(outdir, "*.pdf"))
    if candidates:
        latest = max(candidates, key=os.path.getmtime)
        if latest != output_pdf:
            shutil.move(latest, output_pdf)
        return output_pdf
    raise RuntimeError("LibreOffice produced no PDF output")


def docx_page_count(docx_path):
    tmp_pdf = tempfile.mktemp(suffix=".pdf")
    try:
        docx_to_pdf(docx_path, tmp_pdf)
        result = subprocess.run(["pdfinfo", tmp_pdf], capture_output=True, text=True, timeout=10)
        for line in result.stdout.split("\n"):
            if "Pages" in line:
                return int(line.split(":")[1].strip())
    except Exception:
        return 99
    finally:
        if os.path.exists(tmp_pdf):
            os.unlink(tmp_pdf)
    return 99


def find_best_font_scale(docx_path):
    lo, hi = 0.35, 1.0
    best = lo
    pages = docx_page_count(docx_path)
    if pages <= 1:
        return 1.0
    for _ in range(8):
        mid = (lo + hi) / 2
        tmp = tempfile.mktemp(suffix=".docx")
        shutil.copy(docx_path, tmp)
        modify_docx_font_sizes(tmp, mid, tmp)
        p = docx_page_count(tmp)
        os.unlink(tmp)
        if p <= 1:
            best = mid
            lo = mid
        else:
            hi = mid
    return best


def render_section(paragraphs, ranges, page_w_cm, page_h_cm, margin_cm, font_scale):
    tmp_docx = tempfile.mktemp(suffix=".docx")
    build_compact_docx(paragraphs, ranges, page_w_cm, page_h_cm, margin_cm, tmp_docx)
    modify_docx_font_sizes(tmp_docx, font_scale, tmp_docx)
    tmp_pdf = tempfile.mktemp(suffix=".pdf")
    docx_to_pdf(tmp_docx, tmp_pdf)
    os.unlink(tmp_docx)
    return tmp_pdf


def impose_grid_pages(
    input_pdfs,
    output_pdf,
    cols=3,
    rows=2,
    margin_mm=4,
    gap_mm=3,
    cut_marks=True,
    fill_mode=True,
    labels=None,
):
    page_w, page_h = rl_landscape(A4)
    margin = margin_mm * mm
    gap = gap_mm * mm
    cell_w = (page_w - 2 * margin - (cols - 1) * gap) / cols
    cell_h = (page_h - 2 * margin - (rows - 1) * gap) / rows
    c = canvas.Canvas(output_pdf, pagesize=(page_w, page_h))
    cut_marks_drawn = False
    output_page_num = 0

    for src_idx, pdf_path in enumerate(input_pdfs):
        pinfo = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True, timeout=10)
        src_pages = 1
        for line in pinfo.stdout.split("\n"):
            if "Pages" in line:
                src_pages = int(line.split(":")[1].strip())
                break

        for src_pg in range(1, src_pages + 1):
            if output_page_num > 0:
                c.showPage()
            output_page_num += 1

            tmpdir = tempfile.mkdtemp(prefix="impose_")
            prefix = os.path.join(tmpdir, "p")
            subprocess.run(
                ["pdftoppm", "-png", "-r", "300", "-f", str(src_pg), "-l", str(src_pg), pdf_path, prefix],
                capture_output=True,
                check=True,
            )
            img_files = sorted(glob.glob(f"{prefix}*.png"))
            if not img_files:
                shutil.rmtree(tmpdir, ignore_errors=True)
                continue

            img_path = img_files[0]
            img = Image.open(img_path)
            scale_val = max(cell_w / img.size[0], cell_h / img.size[1]) if fill_mode else min(
                cell_w / img.size[0], cell_h / img.size[1]
            )
            disp_w = img.size[0] * scale_val
            disp_h = img.size[1] * scale_val

            if cut_marks and not cut_marks_drawn:
                c.setStrokeColorRGB(0.82, 0.82, 0.82)
                c.setLineWidth(0.4)
                for gc in range(1, cols):
                    gx = margin + gc * cell_w + (gc - 1) * gap + gap / 2
                    c.line(gx, margin - 3, gx, page_h - margin + 3)
                for gr in range(1, rows):
                    gy = margin + gr * cell_h + (gr - 1) * gap + gap / 2
                    c.line(margin - 3, gy, page_w - margin + 3, gy)
                cut_marks_drawn = True

            for idx in range(cols * rows):
                row = idx // cols
                col = idx % cols
                py = rows - 1 - row
                cx = margin + col * (cell_w + gap)
                cy = margin + py * (cell_h + gap)
                x = cx + (cell_w - disp_w) / 2
                y = cy + (cell_h - disp_h) / 2

                if fill_mode and (disp_w > cell_w or disp_h > cell_h):
                    c.saveState()
                    p = c.beginPath()
                    p.rect(cx, cy, cell_w, cell_h)
                    c.clipPath(p, stroke=0)
                    c.drawImage(img_path, x, y, width=disp_w, height=disp_h)
                    c.restoreState()
                else:
                    c.drawImage(
                        img_path, x, y, width=disp_w, height=disp_h, preserveAspectRatio=True
                    )

                if labels and idx == 0:
                    label = labels[src_idx] if src_idx < len(labels) else ""
                    if src_pages > 1:
                        label += f" p{src_pg}"
                    c.setFont("Helvetica", 6)
                    c.setFillColorRGB(0.5, 0.5, 0.5)
                    c.drawString(cx + 2, cy + cell_h - 10, label)

            shutil.rmtree(tmpdir, ignore_errors=True)

    c.save()
    return output_pdf


def process_exam(
    docx_path,
    cols=3,
    rows=2,
    margin_mm=4,
    gap_mm=3,
    page_margin_cm=0.4,
    split_mode="Auto",
    header_pg2=False,
    manual_scale_a=0,
    manual_scale_b=0,
    scale_a=100,
    scale_b=100,
):
    doc = Document(docx_path)
    paragraphs = doc.paragraphs
    sec_b = find_section_boundary(paragraphs) if split_mode == "Auto" else None
    sec_a = None
    if sec_b is not None:
        for i, p in enumerate(paragraphs):
            if re.match(r"(?i)^section\s+a", p.text.strip()):
                sec_a = i
                break

    pw, ph = rl_landscape(A4)
    mg = margin_mm * mm
    gp = gap_mm * mm
    cw = (pw - 2 * mg - (cols - 1) * gp) / cols
    ch = (ph - 2 * mg - (rows - 1) * gp) / rows
    cw_cm = cw / mm * 0.1
    ch_cm = ch / mm * 0.1

    if sec_b is not None:
        rng_a = [(0, sec_a), (sec_a, sec_b)]
        rng_b = [(sec_b, len(paragraphs))] if not header_pg2 else [(0, sec_a), (sec_b, len(paragraphs))]
    else:
        rng_a = [(0, len(paragraphs))]
        rng_b = None

    tmp_a = tempfile.mktemp(suffix=".docx")
    build_compact_docx(paragraphs, rng_a, cw_cm, ch_cm, page_margin_cm, tmp_a)

    if rng_b:
        tmp_b = tempfile.mktemp(suffix=".docx")
        build_compact_docx(paragraphs, rng_b, cw_cm, ch_cm, page_margin_cm, tmp_b)

    if manual_scale_a > 0:
        sa = manual_scale_a
    else:
        auto_sa = find_best_font_scale(tmp_a)
        sa = auto_sa * (scale_a / 100.0)

    if manual_scale_b > 0:
        sb = manual_scale_b
    elif rng_b:
        auto_sb = find_best_font_scale(tmp_b)
        sb = auto_sb * (scale_b / 100.0)
    else:
        sb = 1.0

    pdf_a = render_section(paragraphs, rng_a, cw_cm, ch_cm, page_margin_cm, sa)
    pdfs = [pdf_a]
    if rng_b:
        pdf_b = render_section(paragraphs, rng_b, cw_cm, ch_cm, page_margin_cm, sb)
        pdfs.append(pdf_b)

    output_pdf = tempfile.mktemp(suffix=".pdf")
    impose_grid_pages(pdfs, output_pdf, cols, rows, margin_mm, gap_mm, cut_marks=True, fill_mode=True, labels=["Section A", "Section B"] if rng_b else None)

    for f in pdfs:
        if os.path.exists(f):
            os.unlink(f)
    if os.path.exists(tmp_a):
        os.unlink(tmp_a)

    return output_pdf


def image_to_pdf(image_path: str, output_pdf: str) -> str:
    """Convert a single image to a PDF page using Pillow."""
    img = Image.open(image_path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(output_pdf, "PDF", resolution=300)
    return output_pdf


def process_single_image(image_path: str, output_pdf: str) -> str:
    """Process a single exam image: convert to PDF with proper sizing on A4."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    if not image_path or not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    img = Image.open(image_path)
    img_w, img_h = img.size

    pw, ph = A4
    scale = min(pw / img_w, ph / img_h) * 0.9
    dw = img_w * scale
    dh = img_h * scale

    c = canvas.Canvas(output_pdf, pagesize=(pw, ph))
    x = (pw - dw) / 2
    y = (ph - dh) / 2
    c.drawImage(image_path, x, y, width=dw, height=dh, preserveAspectRatio=True)
    c.save()
    return output_pdf


def generate_pdf_previews(pdf_path: str, max_w: int = 900, dpi: int = 72) -> list[str]:
    """Convert PDF pages to base64 preview PNGs."""
    tmpdir = tempfile.mkdtemp(prefix="preview_")
    try:
        prefix = os.path.join(tmpdir, "p")
        subprocess.run(
            ["pdftoppm", "-png", f"-r", str(dpi), pdf_path, prefix],
            capture_output=True, timeout=30,
        )
        imgs = sorted(glob.glob(f"{prefix}*.png"))
        previews = []
        for p in imgs:
            img = Image.open(p)
            w, h = img.size
            scale = max_w / w
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, "PNG")
            previews.append(base64.b64encode(buf.getvalue()).decode())
        return previews
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
