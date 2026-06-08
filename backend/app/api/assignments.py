from fastapi import APIRouter, Depends, HTTPException

from app.supabase_db import select, insert, delete
from app.schemas.teacher_assignment import TeacherAssignmentCreate, TeacherAssignmentOut
from app.core.security import CurrentUser, require_admin

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("/", response_model=list[TeacherAssignmentOut])
def list_assignments(
    teacher_id: int | None = None,
    class_id: int | None = None,
    current_user: CurrentUser = Depends(require_admin),
):
    filters = {}
    if teacher_id:
        filters["teacher_id"] = f"eq.{teacher_id}"
    if class_id:
        filters["class_id"] = f"eq.{class_id}"
    data = select("teacher_assignments", filters=filters or None)
    return [TeacherAssignmentOut.model_validate(item) for item in data]


@router.post("/", response_model=TeacherAssignmentOut)
def create_assignment(
    data: TeacherAssignmentCreate,
    current_user: CurrentUser = Depends(require_admin),
):
    existing = select(
        "teacher_assignments",
        filters={
            "teacher_id": f"eq.{data.teacher_id}",
            "class_id": f"eq.{data.class_id}",
            "subject_id": f"eq.{data.subject_id}",
        },
        single=True,
    )
    if existing:
        raise HTTPException(status_code=400, detail="Assignment already exists")
    created = insert(
        "teacher_assignments",
        {
            "teacher_id": data.teacher_id,
            "class_id": data.class_id,
            "subject_id": data.subject_id,
        },
    )
    return TeacherAssignmentOut.model_validate(created[0])


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    existing = select(
        "teacher_assignments",
        filters={"id": f"eq.{assignment_id}"},
        single=True,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Assignment not found")
    delete("teacher_assignments", {"id": f"eq.{assignment_id}"})
    return {"message": "Assignment deleted"}
