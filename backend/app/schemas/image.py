from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ImageOut(BaseModel):
    id: int
    title: str
    number: int
    status: str
    file_path: Optional[str] = None
    pdf_path: Optional[str] = None
    class_id: int
    subject_id: int
    uploaded_by: int
    processed_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImageCreate(BaseModel):
    title: str
    class_id: int
    subject_id: int


class ImageUploadResponse(BaseModel):
    id: int
    title: str
    number: int
    status: str
    file_path: str
    message: str
