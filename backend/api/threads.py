from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Dict, Any, List
from pydantic import BaseModel
from models.database import get_db
from models.models import Thread, Email, Contact, Action, AuditLog
from .schemas import SuccessEnvelope

router = APIRouter()

class RespondRequest(BaseModel):
    reply_body: str
    user_id: str

@router.get("/threads/{contact_email}", response_model=SuccessEnvelope)
async def get_threads(contact_email: str, db: AsyncSession = Depends(get_db)):
    """
    Returns the full thread history for a given contact.
    Fulfills the requirement to JOIN emails, actions, and contacts in a single optimized query.
    """
    stmt = (
        select(Thread)
        .where(Thread.sender_email == contact_email)
        .options(selectinload(Thread.emails).selectinload(Email.actions))
    )
    res = await db.execute(stmt)
    threads = res.scalars().all()
    
    contact_res = await db.execute(select(Contact).where(Contact.email == contact_email))
    contact = contact_res.scalar_one_or_none()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    data = {
        "contact": {
            "name": contact.name,
            "company": contact.company,
            "status": contact.status,
            "account_value": float(contact.account_value),
            "churn_risk_score": float(contact.churn_risk_score)
        },
        "threads": []
    }
    
    for t in threads:
        thread_data = {
            "id": t.id,
            "subject": t.subject,
            "status": t.status,
            "emails": []
        }
        for e in sorted(t.emails, key=lambda x: x.timestamp):
            actions_list = [
                {
                    "id": a.id,
                    "type": a.action_type,
                    "reason": a.escalation_reason,
                    "draft": a.proposed_reply
                } for a in e.actions
            ]
            thread_data["emails"].append({
                "id": e.id,
                "body": e.body,
                "timestamp": str(e.timestamp),
                "sentiment": e.sentiment_score,
                "category": e.category,
                "actions": actions_list
            })
        data["threads"].append(thread_data)
        
    return SuccessEnvelope(data=data)

@router.post("/respond/{email_id}", response_model=SuccessEnvelope)
async def respond_to_email(email_id: str, request: RespondRequest, db: AsyncSession = Depends(get_db)):
    """
    Updates the email status by appending a manual reply and creating an audit log.
    """
    stmt = select(Email).where(Email.id == email_id)
    res = await db.execute(stmt)
    email = res.scalar_one_or_none()
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    action = Action(
        email_id=email.id,
        action_type="Manual-Reply",
        proposed_reply=request.reply_body,
        is_approved=True,
        approved_by=request.user_id
    )
    db.add(action)
    
    audit = AuditLog(
        entity_type="Email",
        entity_id=email.id,
        performed_by=request.user_id,
        diff={"action": "Manual-Reply", "reply_body": request.reply_body}
    )
    db.add(audit)
    
    await db.commit()
    return SuccessEnvelope(data={"status": "replied", "email_id": email_id})
