# SenAI CRM Intelligence System

## Overview
SenAI CRM Intelligence is a real-time AI-powered CRM designed to ingest emails, triage them using heuristics and LLMs, and autonomously route or respond to them via an intelligent ReAct agent. It maintains a structured intelligence layer in PostgreSQL and provides a clean REST API and frontend dashboard for human oversight.

## Tech Stack
- **Backend**: Python (FastAPI) - Provides native async support, excellent LLM ecosystem, and automatic OpenAPI generation via Pydantic.
- **Database**: PostgreSQL with `pgvector` - Allows us to store relational business data (threads, contacts, logs) and vector embeddings (for the knowledge base) in a single system, reducing infrastructure complexity.
- **Frontend**: React (Vite) - Fast scaffolding, modern ecosystem, integrates beautifully with Recharts for analytics.
- **AI/LLM**: Gemini - Strong reasoning capabilities for the agent loop and highly reliable JSON output for structured classification.
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`) - Provides fast, local embedding generation (768 dimensions) at zero marginal API cost, completely sufficient for a targeted knowledge base.

## Trade-offs
- **pgvector vs. Chroma/Pinecone**: We chose pgvector to consolidate our persistence layer. For a knowledge base with under 500 chunks, the performance difference is negligible, and it avoids the distributed data consistency issues of using a separate vector database.
- **ReAct vs. Simple Chain**: A simple chain cannot handle complex conditional flows (like discovering a legal threat mid-thread). The ReAct pattern allows the agent to reason dynamically (Reason -> Act -> Observe) based on retrieved tools, at the acceptable cost of higher latency.
- **Sentence-transformers vs. OpenAI embeddings**: `all-MiniLM-L6-v2` runs locally and is free. 768-dimensional vectors fit neatly in pgvector and offer excellent retrieval quality for our specific corpus size without network overhead.
- **Conflicting Signal Resolution**: When an email contains mixed signals (e.g., positive sentiment but a refund request), the system categorizes based on the **primary business intent** (Billing/Complaint) rather than emotional valence. The confidence score is capped at 0.80 to ensure a human reviews these edge cases.

## Environment Setup
1. Clone the repository.
2. Create a `.env` file with `GEMINI_API_KEY` and other secrets.
3. Run `docker-compose up -d` to start the PostgreSQL (pgvector) database.
4. Set up a Python virtual environment and install backend dependencies.
5. Seed the knowledge base: `python backend/seed_knowledge_base.py`
6. Run the application!
