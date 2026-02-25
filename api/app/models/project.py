import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.security import generate_api_key, generate_project_token
from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=generate_project_token
    )
    api_key: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, default=generate_api_key
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="projects")  # noqa: F821
    experiments: Mapped[list["Experiment"]] = relationship("Experiment", back_populates="project", lazy="selectin")  # noqa: F821
