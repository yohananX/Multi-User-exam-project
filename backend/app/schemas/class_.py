from pydantic import BaseModel
from typing import Optional


class ClassCreate(BaseModel):
    name: str
    section: Optional[str] = None
    school_id: int


class ClassOut(BaseModel):
    id: int
    name: str
    section: Optional[str] = None
    school_id: int

    class Config:
        from_attributes = True
