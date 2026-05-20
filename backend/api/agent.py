from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db
from agent.loop import run_agent
from .schemas import SuccessEnvelope

router = APIRouter()

@router.post("/agent/dry-run/{email_id}", response_model=SuccessEnvelope)
async def agent_dry_run(email_id: str, db: AsyncSession = Depends(get_db)):
    """
    Executes the autonomous agent in dry-run mode for a specific email.
    Intercepts all tool calls with simulated responses and does not write to the DB.
    """
    result = await run_agent(email_id, db, dry_run=True)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
        
    return SuccessEnvelope(data=result)
