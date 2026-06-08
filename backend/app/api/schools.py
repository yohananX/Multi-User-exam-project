from fastapi import APIRouter, Depends, HTTPException

from app.supabase_db import select, insert, delete as supadelete
from app.core.security import require_super_admin, CurrentUser
from app.schemas.school import SchoolCreate, SchoolOut

router = APIRouter(prefix="/api/schools", tags=["schools"])


@router.get("/", response_model=list[SchoolOut])
def list_schools(current_user: CurrentUser = Depends(require_super_admin)):
    return select("schools", order="name.asc")


@router.post("/", response_model=SchoolOut)
def create_school(
    data: SchoolCreate,
    current_user: CurrentUser = Depends(require_super_admin),
):
    result = insert("schools", {"name": data.name, "address": data.address})
    return SchoolOut.model_validate(result[0])


@router.delete("/{school_id}")
def delete_school(
    school_id: int,
    current_user: CurrentUser = Depends(require_super_admin),
):
    existing = select("schools", filters={"id": f"eq.{school_id}"}, single=True)
    if not existing:
        raise HTTPException(status_code=404, detail="School not found")
    supadelete("schools", {"id": f"eq.{school_id}"})
    return {"message": "School deleted"}
