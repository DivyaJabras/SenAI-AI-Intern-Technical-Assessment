from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta, timezone
from models.database import get_db
from .schemas import SuccessEnvelope

router = APIRouter()

@router.get("/analytics/sentiment-trend", response_model=SuccessEnvelope)
async def get_sentiment_trend(
    sender: str = Query(..., description="The sender email to track"),
    days: int = Query(30, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns time-series sentiment data for a given sender, including a 7-period moving average.
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    # Using naive UTC to match how we store timestamps in the ingestion route
    cutoff_date_naive = cutoff_date.replace(tzinfo=None)
    
    # We use a raw SQL query to leverage PostgreSQL's native Window Functions
    # This computes a running average of the last 7 emails
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
        data={"sender": sender, "trend": time_series}
    )
