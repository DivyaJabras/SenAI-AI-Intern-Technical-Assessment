import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models.database import DATABASE_URL
from models.models import KnowledgeChunk
from rag.chunker import chunk_document
from rag.embedder import get_embedding

KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "knowledge")

async def seed_db():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        print("Clearing existing chunks (if any)...")
        await session.execute(KnowledgeChunk.__table__.delete())
        
        for filename in os.listdir(KNOWLEDGE_DIR):
            if not filename.endswith(".md"):
                continue
                
            filepath = os.path.join(KNOWLEDGE_DIR, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            # Chunking strategy: paragraph bounds, 400 tokens, 50 overlap
            chunks = chunk_document(content, chunk_size=400, overlap=50)
            print(f"[{filename}] split into {len(chunks)} chunks.")
            
            for chunk_text in chunks:
                # Embed each chunk with sentence-transformers
                embedding = get_embedding(chunk_text)
                db_chunk = KnowledgeChunk(
                    source_doc=filename,
                    chunk_text=chunk_text,
                    embedding=embedding
                )
                session.add(db_chunk)
                
        print("Committing to database...")
        await session.commit()
        print("Knowledge base seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_db())
