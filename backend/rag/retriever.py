from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import KnowledgeChunk
from .embedder import get_embedding

async def retrieve_chunks(db: AsyncSession, query: str, top_k: int = 3):
    """
    Embeds the search query and performs a pgvector cosine similarity search
    to find the most relevant chunks in the knowledge base.
    """
    query_vec = get_embedding(query)
    
    # In pgvector, cosine distance is `<=>`.
    # Similarity score is `1 - cosine_distance`
    stmt = (
        select(
            KnowledgeChunk.chunk_text,
            KnowledgeChunk.source_doc,
            (1 - KnowledgeChunk.embedding.cosine_distance(query_vec)).label("score")
        )
        .order_by(KnowledgeChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Return as a list of dicts
    return [
        {"chunk_text": row.chunk_text, "source_doc": row.source_doc, "score": float(row.score)}
        for row in rows
    ]
