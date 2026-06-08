from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))

    teacher = relationship("User", back_populates="teacher_assignments")
    class_ = relationship("Class", back_populates="teacher_assignments")
    subject = relationship("Subject", back_populates="teacher_assignments")

    __table_args__ = (
        UniqueConstraint("teacher_id", "class_id", "subject_id"),
    )
