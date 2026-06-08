from pydantic import BaseModel
from typing import Optional


class SchoolCreate(BaseModel):
    name: str
    address: Optional[str] = None


class SchoolOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None

    class Config:
        from_attributes = True
