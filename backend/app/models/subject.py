from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))

    status: Mapped[str] = mapped_column(String(20), default="active")

    ocr_text: Mapped[str | None] = mapped_column(Text(), nullable=True, default=None)
    docx_path: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    imposed_pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    class_ = relationship("Class", back_populates="subjects")
    teacher_assignments = relationship("TeacherAssignment", back_populates="subject")
    images = relationship("Image", back_populates="subject", cascade="all, delete-orphan")
