from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db
from rag.retriever import retrieve_chunks
from .schemas import SuccessEnvelope

router = APIRouter()

@router.get("/rag/search", response_model=SuccessEnvelope)
async def debug_rag_search(
    q: str = Query(..., description="The query to search for in the knowledge base"),
    top_k: int = Query(3, description="Number of results to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Debug endpoint that exposes the RAG retrieval function directly.
    Takes a query and returns the most relevant chunks with similarity scores.
    """
    results = await retrieve_chunks(db, q, top_k)
    return SuccessEnvelope(
        data={
            "query": q,
            "results": results
        }
    )
