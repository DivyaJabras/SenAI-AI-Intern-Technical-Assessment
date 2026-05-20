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

## How to Run the System

The system is composed of three interconnected parts: the Database, the Backend API, and the Frontend Dashboard. You must run them in this exact order.

### 1. Start the Database
Open a terminal in the root directory and start the PostgreSQL container (with `pgvector`):
```bash
docker-compose up -d
```
*(Wait a few seconds for the database to fully initialize).*

### 2. Configure Environment Variables
Create a `.env` file in the root directory. Add your Gemini API key and the database URL:
```env
GEMINI_API_KEY=your_google_gemini_api_key
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/senaicrm
```

### 3. Start the Backend API & Seed Data
Open a **new** terminal in the root directory:
```bash
# Create and activate virtual environment (Windows)
python -m venv .venv
.\.venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Seed the knowledge base (Run this exactly ONCE)
python backend/rag/seed_knowledge_base.py

# Start the API server
uvicorn backend.main:app --reload --port 8000
```
*The backend API documentation is now available at http://localhost:8000/docs*

### 4. Start the Frontend Dashboard
Open a **new** terminal (leave the backend running) and navigate to the frontend folder:
```bash
cd frontend
npm install
npm run dev
```
*The React dashboard is now available at http://localhost:3000*
