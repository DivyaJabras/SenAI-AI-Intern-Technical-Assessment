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

def run_mock_classification(subject: str, body: str, is_security_threat: bool, is_urgent: bool, is_gdpr_request: bool, rag_context: list) -> dict:
    subject_body = f"{subject} {body}".lower()
    
    # 1. Category Heuristics
    category = "General Inquiry"
    if any(k in subject_body for k in ["refund", "charge", "billing", "invoice", "payment", "price", "pricing", "discount"]):
        category = "Billing/Refund"
    elif any(k in subject_body for k in ["down", "outage", "broken", "bug", "crash", "error", "403", "404", "500", "fail", "not working"]):
        category = "Technical Support"
    elif any(k in subject_body for k in ["sales", "buy", "demo", "trial", "enterprise plan"]):
        category = "Sales"
    elif any(k in subject_body for k in ["gdpr", "privacy", "agreement", "legal", "lawsuit", "terms"]):
        category = "Compliance/Legal"
        
    # 2. Sentiment Heuristics
    sentiment = "Neutral"
    sentiment_score = 0.0
    negatives = ["unhappy", "frustrated", "awful", "bad", "slow", "down", "loss", "losing", "worst", "fail", "error", "hate", "issue", "problem"]
    positives = ["great", "good", "happy", "love", "awesome", "perfect", "thanks", "thank you", "excel", "helpful"]
    
    neg_count = sum(1 for k in negatives if k in subject_body)
    pos_count = sum(1 for k in positives if k in subject_body)
    
    if neg_count > pos_count:
        sentiment = "Negative"
        sentiment_score = -0.5 - min(0.4, neg_count * 0.1)
    elif pos_count > neg_count:
        sentiment = "Positive"
        sentiment_score = 0.4 + min(0.5, pos_count * 0.1)
    elif neg_count > 0:
        sentiment = "Mixed"
        sentiment_score = -0.1
        
    # 3. Urgency Heuristics
    urgency = "Medium"
    if is_security_threat or "p0" in subject_body or "outage" in subject_body or "down" in subject_body or "emergency" in subject_body:
        urgency = "Critical"
    elif is_urgent or "p1" in subject_body or "asap" in subject_body or "urgent" in subject_body or "deadline" in subject_body:
        urgency = "High"
    elif "discount" in subject_body or "trial" in subject_body:
        urgency = "Low"
        
    # 4. Requires Human
    requires_human = urgency in ["Critical", "High"] or category == "Compliance/Legal" or is_gdpr_request
    
    # 5. Suggested Reply based on RAG
    suggested_reply = None
    if rag_context:
        best_chunk = rag_context[0]["chunk_text"]
        suggested_reply = f"Thank you for contacting us. Based on our policy: '{best_chunk[:100]}...', we are investigating your request."
    else:
        suggested_reply = "Thank you for reaching out. We have received your email and our team is reviewing it."
        
    return {
        "category": category,
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "urgency": urgency,
        "requires_human": requires_human,
        "confidence": 0.85,
        "detected_entities": {}
    }

async def process_email_background_async(email_id: str):
    from models.database import AsyncSessionLocal
    from services.classification import classify_email, generate_search_query
    from rag.retriever import retrieve_chunks
    from services.sentiment import check_sentiment_deterioration
    from services.intelligence import should_trigger_intelligence, get_or_scrape_intelligence
    from agent.loop import run_agent
    from models.models import Email
    import os
    import json
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch Email
            stmt = select(Email).where(Email.id == email_id)
            res = await db.execute(stmt)
            email = res.scalar_one_or_none()
            if not email:
                return
                
            # 2. Get Thread History
            thread_stmt = select(Email).where(Email.sender == email.sender).order_by(Email.timestamp.desc()).limit(10)
            thread_res = await db.execute(thread_stmt)
            recent_emails = thread_res.scalars().all()
            thread_history = [
                {"sender": e.sender, "body": e.body, "timestamp": str(e.timestamp)}
                for e in reversed(recent_emails) if e.id != email_id
            ]
            
            # 3. RAG Search
            search_query = await generate_search_query(email.subject, email.body)
            rag_context = await retrieve_chunks(db, search_query, top_k=2)
            
            # 4. Run Classification
            key = os.getenv("GEMINI_API_KEY")
            is_configured = bool(key and not key.startswith("your_") and key != "")
            
            if is_configured:
                # Use Gemini
                parsed = await classify_email(email.subject, email.body, thread_history, rag_context)
            else:
                # Mock classification using heuristics
                parsed = run_mock_classification(
                    email.subject, 
                    email.body, 
                    email.is_security_threat, 
                    email.is_urgent, 
                    email.is_gdpr_request, 
                    rag_context
                )
                
            # 5. Update Email Classification in DB
            email.category = parsed.get("category", "General Inquiry")
            s_score = parsed.get("sentiment_score")
            if s_score is None:
                s_label = parsed.get("sentiment", "Neutral")
                s_score = 0.5 if s_label == "Positive" else (-0.5 if s_label == "Negative" else 0.0)
            email.sentiment_score = s_score
            email.urgency = parsed.get("urgency", "Medium")
            email.requires_human = parsed.get("requires_human", False)
            email.confidence = parsed.get("confidence", 0.9)
            email.raw_entities = parsed.get("detected_entities", {})
            
            # Save Classification updates
            await db.commit()
            
            # 6. Check Sentiment Deterioration
            await check_sentiment_deterioration(db, email.sender)
            
            # 7. Run Agent
            await run_agent(email_id, db, dry_run=False)
            
            # 8. Web Reputation Scraping
            if should_trigger_intelligence(email.body, email.sentiment_score, email.category, email.urgency):
                await get_or_scrape_intelligence(db)
                
        except Exception as e:
            import traceback
            print(f"Error in background email processing: {e}")
            traceback.print_exc()

def process_email_background(email_id: str):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        loop.create_task(process_email_background_async(email_id))
    else:
        loop.run_until_complete(process_email_background_async(email_id))

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
