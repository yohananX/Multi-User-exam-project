import enum
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Enum as SAEnum, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ImageStatus(str, enum.Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    number: Mapped[int] = mapped_column(default=0)
    status: Mapped[ImageStatus] = mapped_column(SAEnum(ImageStatus), default=ImageStatus.PENDING)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    processed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    class_ = relationship("Class", back_populates="images")
    subject = relationship("Subject", back_populates="images")
    uploader = relationship("User", foreign_keys=[uploaded_by], back_populates="uploaded_images")
    processor = relationship("User", foreign_keys=[processed_by])
