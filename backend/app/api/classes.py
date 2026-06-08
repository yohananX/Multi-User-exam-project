from fastapi import APIRouter, Depends, HTTPException

from app.supabase_db import select, insert, delete
from app.core.security import CurrentUser, get_current_user, require_admin
from app.schemas.class_ import ClassCreate, ClassOut

router = APIRouter(prefix="/api/classes", tags=["classes"])

CLASS_SORT_ORDER = {
    "Reception": 0,
    "Primary 1": 1, "Primary 2": 2, "Primary 3": 3, "Primary 4": 4,
    "Primary 5": 5, "Primary 6": 6,
    "JSS 1": 7, "JSS 2": 8, "JSS 3": 9,
    "SS 1": 10, "SS 2": 11, "SS 3": 12,
}


@router.get("/", response_model=list[ClassOut])
def list_classes(
    school_id: int | None = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role == "teacher":
        assignments = select("teacher_assignments", filters={"teacher_id": f"eq.{current_user.id}"})
        class_ids = [a["class_id"] for a in assignments]
        if not class_ids:
            return []
        results = select("classes", filters={"id": f"in.({','.join(map(str, class_ids))})"})
    else:
        filters = {}
        if current_user.role == "school_admin" and current_user.school_id:
            filters["school_id"] = f"eq.{current_user.school_id}"
        elif school_id:
            filters["school_id"] = f"eq.{school_id}"
        results = select("classes", filters=filters or None)
    results.sort(key=lambda c: CLASS_SORT_ORDER.get(c["name"], 99))
    return [ClassOut.model_validate(r) for r in results]


@router.post("/", response_model=ClassOut)
def create_class(
    data: ClassCreate,
    current_user: CurrentUser = Depends(require_admin),
):
    result = insert("classes", data.model_dump())
    created = result[0] if isinstance(result, list) else result
    return ClassOut.model_validate(created)


@router.delete("/{class_id}")
def delete_class(
    class_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    cls = select("classes", filters={"id": f"eq.{class_id}"}, single=True)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    delete("classes", {"id": f"eq.{class_id}"})
    return {"message": "Class deleted"}
