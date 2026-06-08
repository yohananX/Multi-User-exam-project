from fastapi import APIRouter, Depends, HTTPException, status

from app.supabase_db import select, insert
from app.schemas.user import LoginRequest, TokenResponse, UserOut, UserCreate
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, CurrentUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    user = select("users", filters={"username": f"eq.{req.username}"}, single=True)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return TokenResponse(access_token=token, user=UserOut(**user))


@router.post("/register", response_model=UserOut)
def register(req: UserCreate):
    existing = select("users", filters={"username": f"eq.{req.username}"}, single=True)
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    data = req.model_dump(exclude={"school_name"})
    if req.school_name:
        existing_school = select("schools", filters={"name": f"eq.{req.school_name}"}, single=True)
        if existing_school:
            raise HTTPException(status_code=409, detail="School name already taken")
        school = insert("schools", {"name": req.school_name, "address": ""})
        if isinstance(school, list):
            school = school[0]
        data["school_id"] = school["id"]
        data["role"] = "school_admin"
    data["password_hash"] = hash_password(data.pop("password"))
    user = insert("users", data)
    if isinstance(user, list):
        user = user[0]
    return UserOut(**user)


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return UserOut(**current_user.__dict__)
