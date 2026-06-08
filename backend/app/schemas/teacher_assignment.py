from pydantic import BaseModel


class TeacherAssignmentCreate(BaseModel):
    teacher_id: int
    class_id: int
    subject_id: int


class TeacherAssignmentOut(BaseModel):
    id: int
    teacher_id: int
    class_id: int
    subject_id: int

    class Config:
        from_attributes = True
