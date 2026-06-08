from fastapi import APIRouter, Depends, HTTPException

from app.supabase_db import select, insert, update, delete
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.core.security import hash_password, require_super_admin, require_admin, CurrentUser

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(current_user: CurrentUser = Depends(require_admin)):
    filters = None
    if current_user.role == "school_admin":
        filters = {"school_id": f"eq.{current_user.school_id}"}
    users = select("users", filters=filters)
    return [UserOut.model_validate(u) for u in users]


@router.post("/", response_model=UserOut)
def create_user(
    data: UserCreate,
    current_user: CurrentUser = Depends(require_super_admin),
):
    if select("users", filters={"username": f"eq.{data.username}"}, single=True) or \
       select("users", filters={"email": f"eq.{data.email}"}, single=True):
        raise HTTPException(status_code=400, detail="Username or email already exists")
    user = insert("users", {
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role,
        "school_id": data.school_id,
    })
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
):
    user = select("users", filters={"id": f"eq.{user_id}"}, single=True)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = {}
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    if data.email is not None:
        update_data["email"] = data.email
    if data.password:
        update_data["password_hash"] = hash_password(data.password)
    if data.role is not None:
        update_data["role"] = data.role
    if data.school_id is not None:
        update_data["school_id"] = data.school_id
    updated = update("users", update_data, {"id": f"eq.{user_id}"})
    return UserOut.model_validate(updated)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: CurrentUser = Depends(require_super_admin),
):
    user = select("users", filters={"id": f"eq.{user_id}"}, single=True)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    delete("users", {"id": f"eq.{user_id}"})
    return {"message": "User deleted"}
