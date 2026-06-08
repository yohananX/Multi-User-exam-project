from fastapi import APIRouter, Depends

from app.supabase_db import select, count as supabase_count
from app.core.security import CurrentUser, get_current_user, require_admin

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/teacher")
def teacher_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "teacher":
        return {"error": "Only for teachers"}

    assignments = select("teacher_assignments", filters={"teacher_id": f"eq.{current_user.id}"})

    total_subjects = len(assignments)
    subject_details = []

    for assn in assignments:
        cls = select("classes", filters={"id": f"eq.{assn['class_id']}"}, single=True)
        subj = select("subjects", filters={"id": f"eq.{assn['subject_id']}"}, single=True)

        images = select("images", filters={"subject_id": f"eq.{assn['subject_id']}"})
        total_images = len(images)
        pending = sum(1 for i in images if i['status'] == 'pending')
        in_review = sum(1 for i in images if i['status'] == 'in_review')
        completed = sum(1 for i in images if i['status'] == 'completed')

        subject_details.append({
            "class_id": assn['class_id'],
            "class_name": cls['name'] if cls else f"Class {assn['class_id']}",
            "subject_id": assn['subject_id'],
            "subject_name": subj['name'] if subj else f"Subject {assn['subject_id']}",
            "status": subj['status'] if subj else "active",
            "total_images": total_images,
            "pending": pending,
            "in_review": in_review,
            "completed": completed,
        })

    subjects_with_pending = sum(1 for s in subject_details if s["pending"] > 0)
    subjects_all_completed = sum(1 for s in subject_details if s["total_images"] > 0 and s["pending"] == 0 and s["in_review"] == 0)

    return {
        "total_subjects": total_subjects,
        "subjects_with_pending": subjects_with_pending,
        "subjects_all_completed": subjects_all_completed,
        "subjects": subject_details,
    }


@router.get("/admin")
def admin_dashboard(
    current_user: CurrentUser = Depends(require_admin),
):
    all_images = select("images")
    total_images = len(all_images)
    pending = sum(1 for i in all_images if i['status'] == 'pending')
    in_review = sum(1 for i in all_images if i['status'] == 'in_review')
    completed = sum(1 for i in all_images if i['status'] == 'completed')

    all_teachers = select("users", filters={"role": "eq.teacher"})
    total_teachers = len(all_teachers)

    all_subjects = select("subjects")
    total_subjects = len(all_subjects)

    recent_images = select("images", order="created_at.desc", limit=10)
    recent_uploads = []
    for img in recent_images:
        cls = select("classes", filters={"id": f"eq.{img['class_id']}"}, single=True)
        subj = select("subjects", filters={"id": f"eq.{img['subject_id']}"}, single=True)
        uploader = select("users", filters={"id": f"eq.{img['uploaded_by']}"}, single=True)
        recent_uploads.append({
            "id": img['id'],
            "title": img['title'],
            "number": img['number'],
            "status": img['status'],
            "class_id": img['class_id'],
            "class_name": cls['name'] if cls else f"Class {img['class_id']}",
            "subject_id": img['subject_id'],
            "subject_name": subj['name'] if subj else f"Subject {img['subject_id']}",
            "uploaded_by_name": uploader['full_name'] if uploader else f"User #{img['uploaded_by']}",
            "created_at": img['created_at'],
        })

    return {
        "total_images": total_images,
        "pending": pending,
        "in_review": in_review,
        "completed": completed,
        "total_teachers": total_teachers,
        "total_subjects": total_subjects,
        "recent_uploads": recent_uploads,
    }


@router.get("/structure")
def get_structure(
    current_user: CurrentUser = Depends(require_admin),
):
    classes = select("classes", order="name.asc")
    result = []
    for cls in classes:
        subjects = select("subjects", filters={"class_id": f"eq.{cls['id']}"}, order="name.asc")
        subject_list = []
        for subj in subjects:
            images = select("images", filters={"subject_id": f"eq.{subj['id']}"})
            total = len(images)
            pending = sum(1 for i in images if i['status'] == 'pending')
            in_review = sum(1 for i in images if i['status'] == 'in_review')
            completed = sum(1 for i in images if i['status'] == 'completed')
            subject_list.append({
                "id": subj['id'],
                "name": subj['name'],
                "status": subj['status'],
                "total_images": total,
                "pending": pending,
                "in_review": in_review,
                "completed": completed,
            })
        result.append({
            "id": cls['id'],
            "name": cls['name'],
            "section": cls['section'],
            "subjects": subject_list,
        })
    return result
