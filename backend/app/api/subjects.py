from fastapi import APIRouter, Depends, HTTPException

from app.supabase_db import select, insert, update, delete
from app.schemas.subject import SubjectCreate, SubjectOut
from app.core.security import require_admin

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


@router.get("/", response_model=list[SubjectOut])
def list_subjects(class_id: int | None = None):
    filters = {"class_id": f"eq.{class_id}"} if class_id else None
    return select("subjects", filters=filters)


@router.post("/", response_model=SubjectOut)
def create_subject(
    data: SubjectCreate,
    current_user=Depends(require_admin),
):
    subj = insert("subjects", {"name": data.name, "class_id": data.class_id})
    return SubjectOut.model_validate(subj)


@router.patch("/{subject_id}/status")
def update_subject_status(
    subject_id: int,
    data: dict,
    current_user=Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    update("subjects", {"status": data.get("status", "active")}, {"id": f"eq.{subject_id}"})
    return {"message": "Status updated", "status": data.get("status", "active")}


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    current_user=Depends(require_admin),
):
    subj = select("subjects", filters={"id": f"eq.{subject_id}"}, single=True)
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    delete("subjects", {"id": f"eq.{subject_id}"})
    return {"message": "Subject deleted"}
