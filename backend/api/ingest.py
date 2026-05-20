from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.database import get_db
from models.models import Email, Thread, Contact
from .schemas import EmailIngestRequest, SuccessEnvelope, ErrorEnvelope
from typing import Dict, Any

router = APIRouter()

def run_heuristic_prefilter(email: EmailIngestRequest) -> Dict[str, Any]:
    flags = {
        "is_spam": False,
        "is_security_threat": False,
        "is_internal": False,
        "is_urgent": False,
        "is_gdpr_request": False,
        "priority_score": 50,
        "urgency": None
    }
    
    text_to_scan = f"{email.subject} {email.body}".lower()
    sender_domain = email.sender.split('@')[-1].lower()
    
    # 1. Spam check
    spam_domains = ["marketing-guru.io", "nigerian-prince.net"]
    if sender_domain in spam_domains:
        flags["is_spam"] = True
        flags["priority_score"] = 0
        return flags
        
    # 2. Internal check
    internal_domains = ["internal.com", "mycompany.com"]
    if sender_domain in internal_domains:
        flags["is_internal"] = True
        
    # 3. Security Threat
    security_keywords = ["suspicious login", "btc", "bitcoin", "ransomware", "data breach", "hack", "pay or", "publish data"]
    if any(k in text_to_scan for k in security_keywords):
        flags["is_security_threat"] = True
        flags["urgency"] = "Critical"
        flags["priority_score"] = 100
        
    # 4. GDPR check
    gdpr_keywords = ["gdpr", "article 20", "data portability", "data subject request", "right to erasure", "article 17"]
    if any(k in text_to_scan for k in gdpr_keywords):
        flags["is_gdpr_request"] = True
        flags["priority_score"] = 90
        
    # 5. Urgency check
    urgent_keywords = ["urgent", "p0", "legal", "cease and desist", "lawsuit", "breach"]
    if any(k in text_to_scan for k in urgent_keywords):
        flags["is_urgent"] = True
        if not flags["urgency"]:
            flags["urgency"] = "High"
        flags["priority_score"] = max(flags["priority_score"], 80)
        
    return flags

def process_email_background(email_id: str):
    # This is where LLM processing will happen. Placeholder for now.
    pass

@router.post("/ingest", response_model=SuccessEnvelope)
async def ingest_email(
    request: EmailIngestRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Deduplication check
        result = await db.execute(select(Email).where(Email.id == request.message_id))
        existing_email = result.scalar_one_or_none()
        
        if existing_email:
            return SuccessEnvelope(
                data={"status": "duplicate", "message_id": request.message_id, "existing_id": existing_email.id}
            )
            
        # 2. Run Heuristic Pre-filter
        flags = run_heuristic_prefilter(request)
        
        # 3. Upsert Contact
        contact_res = await db.execute(select(Contact).where(Contact.email == request.sender))
        contact = contact_res.scalar_one_or_none()
        if not contact:
            contact = Contact(email=request.sender)
            db.add(contact)
            
        # 4. Upsert Thread
        thread_res = await db.execute(select(Thread).where(Thread.id == request.thread_id))
        thread = thread_res.scalar_one_or_none()
        if not thread:
            thread = Thread(id=request.thread_id, sender_email=request.sender)
            db.add(thread)
            
        # 5. Insert Email
        new_email = Email(
            id=request.message_id,
            thread_id=request.thread_id,
            sender=request.sender,
            subject=request.subject,
            body=request.body,
            timestamp=request.timestamp.replace(tzinfo=None), # Store as naive UTC
            is_spam=flags["is_spam"],
            is_security_threat=flags["is_security_threat"],
            is_internal=flags["is_internal"],
            is_urgent=flags["is_urgent"],
            is_gdpr_request=flags["is_gdpr_request"],
            urgency=flags["urgency"]
        )
        db.add(new_email)
        
        await db.commit()
        
        # 6. Queue for LLM processing
        background_tasks.add_task(process_email_background, request.message_id)
        
        return SuccessEnvelope(
            data={"status": "queued", "job_id": request.message_id}
        )
        
    except Exception as e:
        await db.rollback()
        raise e
