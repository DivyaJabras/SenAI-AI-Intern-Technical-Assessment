from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.models import Email, Action, Contact

async def check_sentiment_deterioration(db: AsyncSession, sender_email: str):
    """
    Runs after an email is classified. Checks if the last 3 emails from this sender 
    have a sentiment_score < -0.3. If so, creates an escalation alert and updates churn risk.
    """
    stmt = (
        select(Email)
        .where(Email.sender == sender_email)
        .where(Email.sentiment_score.isnot(None))
        .order_by(Email.timestamp.desc())
        .limit(5)
    )
    res = await db.execute(stmt)
    recent_emails = res.scalars().all()
    
    if len(recent_emails) < 3:
        return
        
    # Check if the 3 most recent emails are ALL negative
    top_3 = recent_emails[:3]
    if all(e.sentiment_score < -0.3 for e in top_3):
        # 1. Create Escalation Action
        action = Action(
            email_id=top_3[0].id,
            action_type="Escalate",
            escalation_reason="Sentiment deterioration: 3+ consecutive negative emails"
        )
        db.add(action)
        
        # 2. Update churn risk score for the contact
        await db.execute(
            update(Contact)
            .where(Contact.email == sender_email)
            .values(churn_risk_score=0.9)
        )
        
        await db.commit()
