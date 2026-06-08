from fastapi import APIRouter, Depends, HTTPException, Body

from app.supabase_db import select, insert, delete, count as db_count
from app.core.security import hash_password, require_admin, CurrentUser
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/teachers", response_model=list[dict])
def list_teachers(
    current_user: CurrentUser = Depends(require_admin),
):
    teachers = select("users", filters={"role": "eq.teacher"})
    result = []
    for t in teachers:
        assignments = select("teacher_assignments", filters={"teacher_id": f"eq.{t['id']}"})
        total_images_count = db_count("images", filters={"uploaded_by": f"eq.{t['id']}"})
        result.append({
            "id": t["id"],
            "username": t["username"],
            "full_name": t["full_name"],
            "email": t["email"],
            "total_assignments": len(assignments),
            "total_images": total_images_count,
        })
    return result


@router.get("/teachers/{teacher_id}/assignments")
def get_teacher_assignments(
    teacher_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    assignments = select("teacher_assignments", filters={"teacher_id": f"eq.{teacher_id}"})
    result = []
    for a in assignments:
        cls = select("classes", filters={"id": f"eq.{a['class_id']}"}, single=True)
        subj = select("subjects", filters={"id": f"eq.{a['subject_id']}"}, single=True)
        result.append({
            "id": a["id"],
            "class_id": a["class_id"],
            "class_name": cls["name"] if cls else f"Class {a['class_id']}",
            "subject_id": a["subject_id"],
            "subject_name": subj["name"] if subj else f"Subject {a['subject_id']}",
        })
    return result


@router.post("/teachers/{teacher_id}/assignments")
def add_teacher_assignment(
    teacher_id: int,
    class_id: int,
    subject_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    existing = select(
        "teacher_assignments",
        filters={
            "teacher_id": f"eq.{teacher_id}",
            "class_id": f"eq.{class_id}",
            "subject_id": f"eq.{subject_id}",
        },
        single=True,
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already assigned")

    insert("teacher_assignments", {
        "teacher_id": teacher_id,
        "class_id": class_id,
        "subject_id": subject_id,
    })
    return {"message": "Assignment added"}


@router.post("/teachers/{teacher_id}/assignments/batch")
def add_teacher_assignments_batch(
    teacher_id: int,
    class_id: int,
    subject_ids: list[int] = Body(...),
    current_user: CurrentUser = Depends(require_admin),
):
    added = 0
    skipped = 0
    for subject_id in subject_ids:
        existing = select(
            "teacher_assignments",
            filters={
                "teacher_id": f"eq.{teacher_id}",
                "class_id": f"eq.{class_id}",
                "subject_id": f"eq.{subject_id}",
            },
            single=True,
        )
        if existing:
            skipped += 1
            continue
        insert("teacher_assignments", {
            "teacher_id": teacher_id,
            "class_id": class_id,
            "subject_id": subject_id,
        })
        added += 1
    return {"message": f"Added {added} assignment(s), {skipped} skipped", "added": added, "skipped": skipped}


@router.delete("/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    teacher = select("users", filters={"id": f"eq.{teacher_id}", "role": "eq.teacher"}, single=True)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    delete("teacher_assignments", {"teacher_id": f"eq.{teacher_id}"})
    delete("users", {"id": f"eq.{teacher_id}"})
    return {"message": "Teacher deleted"}


@router.delete("/assignments/{assignment_id}")
def remove_assignment(
    assignment_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    assn = select("teacher_assignments", filters={"id": f"eq.{assignment_id}"}, single=True)
    if not assn:
        raise HTTPException(status_code=404, detail="Assignment not found")
    delete("teacher_assignments", {"id": f"eq.{assignment_id}"})
    return {"message": "Assignment removed"}


@router.post("/teachers", response_model=UserOut)
def create_teacher(
    data: UserCreate,
    current_user: CurrentUser = Depends(require_admin),
):
    existing = select("users", filters={"username": f"eq.{data.username}"}, single=True)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user_data = {
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "role": "teacher",
        "school_id": data.school_id,
    }
    result = insert("users", user_data)
    created = result[0] if isinstance(result, list) else result
    return UserOut.model_validate(created)
