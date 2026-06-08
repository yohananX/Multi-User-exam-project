from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = "teacher"
    school_id: Optional[int] = None
    school_name: Optional[str] = None  # creates a new school if provided


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    school_id: Optional[int] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    school_id: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
