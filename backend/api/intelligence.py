from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db
from models.models import WebIntelligenceCache
from .schemas import SuccessEnvelope

router = APIRouter()

@router.get("/intelligence/reputation", response_model=SuccessEnvelope)
async def get_reputation(db: AsyncSession = Depends(get_db)):
    """
    Returns the most recent cached scrape result for the company's profile pages.
    """
    stmt = (
        select(WebIntelligenceCache)
        .order_by(WebIntelligenceCache.id.desc())
        .limit(1)
    )
    res = await db.execute(stmt)
    cache = res.scalar_one_or_none()
    
    if not cache:
        return SuccessEnvelope(data={"status": "no_data_available"})
        
    return SuccessEnvelope(
        data={
            "target_domain": cache.target_domain,
            "data": cache.data,
            "expires_at": str(cache.expires_at)
        }
    )
