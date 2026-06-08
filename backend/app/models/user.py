import enum
from sqlalchemy import String, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    TEACHER = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole))
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id"), nullable=True)

    school = relationship("School", back_populates="users")
    teacher_assignments = relationship("TeacherAssignment", back_populates="teacher")
    uploaded_images = relationship("Image", foreign_keys="Image.uploaded_by", back_populates="uploader")
