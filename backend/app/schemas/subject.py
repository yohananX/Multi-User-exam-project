from pydantic import BaseModel
from typing import Optional


class SubjectCreate(BaseModel):
    name: str
    class_id: int


class SubjectOut(BaseModel):
    id: int
    name: str
    class_id: int
    status: str = "active"

    class Config:
        from_attributes = True
