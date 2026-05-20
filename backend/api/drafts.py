from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
from pydantic import BaseModel
from models.database import get_db
from models.models import Action, AuditLog
from .schemas import SuccessEnvelope

router = APIRouter()

class DraftUpdateRequest(BaseModel):
    new_reply_body: str
    user_id: str

class DraftApproveRequest(BaseModel):
    user_id: str

@router.patch("/drafts/{action_id}", response_model=SuccessEnvelope)
async def update_draft(action_id: int, request: DraftUpdateRequest, db: AsyncSession = Depends(get_db)):
    """
    Updates a drafted reply and writes the diff to the audit log.
    """
    stmt = select(Action).where(Action.id == action_id)
    res = await db.execute(stmt)
    action = res.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Draft/Action not found")
        
    old_body = action.proposed_reply
    action.proposed_reply = request.new_reply_body
    
    audit = AuditLog(
        entity_type="Action",
        entity_id=str(action.id),
        performed_by=request.user_id,
        diff={"old_draft": old_body, "new_draft": request.new_reply_body}
    )
    db.add(audit)
    
    await db.commit()
    return SuccessEnvelope(data={"status": "draft_updated", "action_id": action_id})

@router.post("/drafts/{action_id}/approve", response_model=SuccessEnvelope)
async def approve_draft(action_id: int, request: DraftApproveRequest, db: AsyncSession = Depends(get_db)):
    """
    Approves a draft, triggering a send, and writes the approval event to the audit log.
    """
    stmt = select(Action).where(Action.id == action_id)
    res = await db.execute(stmt)
    action = res.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Draft/Action not found")
        
    action.is_approved = True
    action.approved_by = request.user_id
    
    audit = AuditLog(
        entity_type="Action",
        entity_id=str(action.id),
        performed_by=request.user_id,
        diff={"is_approved": {"old": False, "new": True}}
    )
    db.add(audit)
    
    await db.commit()
    return SuccessEnvelope(data={"status": "draft_approved", "action_id": action_id})
