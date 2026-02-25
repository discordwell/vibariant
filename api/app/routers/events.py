from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_project_token
from app.models.event import Event

router = APIRouter(tags=["events"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EventItem(BaseModel):
    visitor_id: str
    session_id: str
    experiment_assignments: dict | None = None
    event_type: str
    payload: dict | None = None
    timestamp: datetime


class BatchEventsRequest(BaseModel):
    events: list[EventItem]
    # Fallback auth for sendBeacon (which cannot set custom headers)
    projectToken: str | None = None


class BatchEventsResponse(BaseModel):
    accepted: int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/events", response_model=BatchEventsResponse)
async def ingest_events(
    body: BatchEventsRequest,
    x_project_token: Optional[str] = Header(None, alias="X-Project-Token"),
    db: AsyncSession = Depends(get_db),
) -> BatchEventsResponse:
    """Batch event ingestion from the SDK.

    Accepts authentication via X-Project-Token header (preferred) or
    projectToken in the request body (fallback for sendBeacon which
    cannot set custom headers).
    """
    token = x_project_token or body.projectToken
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing project token: provide X-Project-Token header or projectToken in body",
        )
    project = await verify_project_token(token, db)

    events = [
        Event(
            project_id=project.id,
            visitor_id=item.visitor_id,
            session_id=item.session_id,
            experiment_assignments=item.experiment_assignments,
            event_type=item.event_type,
            payload=item.payload,
            timestamp=item.timestamp,
        )
        for item in body.events
    ]
    db.add_all(events)
    await db.flush()

    return BatchEventsResponse(accepted=len(events))
