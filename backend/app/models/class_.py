from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))

    school = relationship("School", back_populates="classes")
    subjects = relationship("Subject", back_populates="class_", cascade="all, delete-orphan")
    teacher_assignments = relationship("TeacherAssignment", back_populates="class_")
    images = relationship("Image", back_populates="class_", cascade="all, delete-orphan")
