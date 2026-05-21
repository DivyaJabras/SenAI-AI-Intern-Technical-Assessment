from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone
from models.database import get_db
from models.models import Email, Contact, Action
from .schemas import SuccessEnvelope

router = APIRouter()

@router.get("/analytics/sentiment-trend", response_model=SuccessEnvelope)
async def get_sentiment_trend(
    sender: str = Query(None, description="The sender email to track (optional, returns global if not specified)"),
    days: int = Query(30, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns time-series sentiment data for a given sender or globally, including a 7-period moving average.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    # Using naive UTC to match how we store timestamps in the ingestion route
    cutoff_date_naive = cutoff_date.replace(tzinfo=None)
    
    if sender:
        # Using a raw SQL query to leverage PostgreSQL's native Window Functions
        query = text("""
            SELECT 
                timestamp,
                sentiment_score,
                category,
                AVG(sentiment_score) OVER (
                    PARTITION BY sender 
                    ORDER BY timestamp 
                    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                ) as moving_average_7d
            FROM emails
            WHERE sender = :sender 
              AND timestamp >= :cutoff
              AND sentiment_score IS NOT NULL
            ORDER BY timestamp ASC
        """)
        result = await db.execute(query, {"sender": sender, "cutoff": cutoff_date_naive})
    else:
        # Global query across all senders
        query = text("""
            SELECT 
                timestamp,
                sentiment_score,
                category,
                AVG(sentiment_score) OVER (
                    ORDER BY timestamp 
                    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                ) as moving_average_7d
            FROM emails
            WHERE timestamp >= :cutoff
              AND sentiment_score IS NOT NULL
            ORDER BY timestamp ASC
        """)
        result = await db.execute(query, {"cutoff": cutoff_date_naive})
        
    rows = result.all()
    
    time_series = [
        {
            "timestamp": str(row.timestamp),
            "sentiment_score": float(row.sentiment_score),
            "category": row.category,
            "moving_average_7d": float(row.moving_average_7d) if row.moving_average_7d is not None else None
        }
        for row in rows
    ]
    
    return SuccessEnvelope(
        data={"sender": sender or "all", "trend": time_series}
    )

@router.get("/analytics/emails", response_model=SuccessEnvelope)
async def get_all_emails(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """
    Returns all emails in the database sorted by timestamp.
    """
    stmt = (
        select(Email)
        .options(selectinload(Email.actions))
        .order_by(Email.timestamp.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    emails = res.scalars().all()
    
    emails_data = []
    for e in emails:
        actions_list = [
            {
                "id": a.id,
                "type": a.action_type,
                "reason": a.escalation_reason,
                "draft": a.proposed_reply
            } for a in e.actions
        ]
        emails_data.append({
            "id": e.id,
            "thread_id": e.thread_id,
            "sender": e.sender,
            "subject": e.subject,
            "body": e.body,
            "timestamp": str(e.timestamp),
            "sentiment": e.sentiment_score,
            "category": e.category,
            "urgency": e.urgency,
            "requires_human": e.requires_human,
            "is_spam": e.is_spam,
            "actions": actions_list
        })
    return SuccessEnvelope(data={"emails": emails_data})

@router.get("/analytics/stats", response_model=SuccessEnvelope)
async def get_analytics_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns summary statistics for the dashboard.
    """
    # 1. Category counts
    cat_stmt = select(Email.category, func.count(Email.id)).group_by(Email.category)
    cat_res = await db.execute(cat_stmt)
    categories = {row[0]: row[1] for row in cat_res.all() if row[0] is not None}
    
    # 2. Performance stats
    ar_stmt = select(func.count(Action.id)).where(Action.action_type == 'Replied')
    ar_res = await db.execute(ar_stmt)
    auto_replies_count = ar_res.scalar() or 0
    
    esc_stmt = select(func.count(Action.id)).where(Action.action_type == 'Escalate')
    esc_res = await db.execute(esc_stmt)
    escalations_count = esc_res.scalar() or 0
    
    lf_stmt = select(func.count(Action.id)).where(Action.action_type == 'Legal-Flag')
    lf_res = await db.execute(lf_stmt)
    legal_flags_count = lf_res.scalar() or 0
    
    conf_stmt = select(func.avg(Email.confidence))
    conf_res = await db.execute(conf_stmt)
    avg_confidence = float(conf_res.scalar() or 0.92)
    
    # 3. At-risk accounts
    risk_stmt = (
        select(Contact)
        .where(Contact.churn_risk_score > 0.7)
        .order_by(Contact.churn_risk_score.desc())
    )
    risk_res = await db.execute(risk_stmt)
    risk_contacts = risk_res.scalars().all()
    
    at_risk_list = []
    for c in risk_contacts:
        reason = "High churn risk"
        email_stmt = (
            select(Email)
            .where(Email.sender == c.email)
            .order_by(Email.timestamp.desc())
            .limit(1)
        )
        email_res = await db.execute(email_stmt)
        latest_email = email_res.scalar_one_or_none()
        if latest_email:
            if latest_email.urgency == "Critical":
                reason = "SLA Breach / Legal Threat"
            elif latest_email.is_security_threat:
                reason = "Security Threat detected"
            elif latest_email.sentiment_score is not None and latest_email.sentiment_score < -0.3:
                reason = "3 consecutive negative emails"
        
        at_risk_list.append({
            "email": c.email,
            "name": c.name or c.email.split('@')[0].capitalize(),
            "company": c.company or "Enterprise",
            "churn_risk_score": float(c.churn_risk_score),
            "reason": reason
        })
        
    return SuccessEnvelope(data={
        "categories": categories,
        "performance": {
            "auto_replies": auto_replies_count,
            "escalations": escalations_count,
            "legal_flags": legal_flags_count,
            "avg_confidence": avg_confidence
        },
        "at_risk_contacts": at_risk_list
    })

@router.get("/analytics/contacts", response_model=SuccessEnvelope)
async def get_analytics_contacts(db: AsyncSession = Depends(get_db)):
    """
    Returns list of all contacts to populate selector dropdown.
    """
    stmt = select(Contact).order_by(Contact.email)
    res = await db.execute(stmt)
    contacts = res.scalars().all()
    
    contacts_data = [
        {
            "email": c.email,
            "name": c.name or c.email.split('@')[0].capitalize()
        } for c in contacts
    ]
    return SuccessEnvelope(data={"contacts": contacts_data})
