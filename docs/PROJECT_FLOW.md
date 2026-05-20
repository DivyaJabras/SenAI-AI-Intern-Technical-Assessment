# SenAI CRM: Full System Flow

This document outlines the end-to-end lifecycle of an email as it moves through the SenAI CRM Intelligence ecosystem.

## 1. Ingestion Layer
- **Input**: An incoming email (via JSON/webhook or our streaming simulator) hits the `POST /api/ingest` endpoint.
- **Deduplication**: The system checks the database if the exact email signature has been processed within the last 5 minutes to prevent duplicates.
- **Heuristic Pre-filter**: Standard regex and keyword matching are used to immediately flag obvious attributes (e.g., `is_spam=True` if "Viagra" is mentioned, `is_gdpr_request=True` if "right to be forgotten" is seen).
- **Database Storage**: The email is added to the `emails` table in the PostgreSQL database, which automatically kicks off the asynchronous processing pipeline.

## 2. Intelligence Core & RAG
- **Classification Engine**: The background pipeline passes the email to the LLM Classification Engine (powered by Gemini 1.5).
- **RAG Retrieval**: Based on the email content, the engine queries the `pgvector` knowledge base (which contains our Markdown policies like SLA, Refund, Pricing) to inject relevant company rules into the prompt.
- **Structured Output**: The LLM outputs a strict JSON schema scoring the email's sentiment (-1.0 to 1.0), categorizing it (Support, Sales, etc.), and assigning a calculated urgency (Low to Critical).

## 3. Autonomous Triage Agent (ReAct)
- **Agent Loop**: Once classified, the email enters the ReAct (Reasoning and Acting) loop. The Gemini-powered agent uses a "Thought -> Action -> Observation" cycle to independently figure out how to resolve the email.
- **Tool Usage**: The agent has access to 9 specific database and logic tools. It can:
  - Call `get_thread_history` to read past emails from the sender.
  - Call `get_contact_profile` to check if the sender is a VIP.
  - Call `draft_reply` to generate a highly contextual response.
- **Hard Rules**: The loop enforces strict business logic in code. For example, if the urgency is "Critical", the agent is programmatically blocked from auto-replying and must call `escalate_to_human`. All reasoning steps are logged to the `actions` table.

## 4. Specialized Processors
- **Sentiment Deterioration Tracker**: A post-processing script checks the sender's history. If the last 3 consecutive emails scored below -0.3 sentiment, the account is automatically flagged with a high `churn_risk_score` (e.g., 0.9) and an Escalation action is generated.
- **Live Web Intelligence**: If the email mentions "review", "Trustpilot", or "G2", an asynchronous scraper checks public reputation sites and caches the data for the agent to use in its context window.

## 5. React Frontend Dashboard (Mission Control)
- **Inbox View**: Human agents log into the React dashboard. They see a real-time table of all communications, with color-coded sentiment and urgency badges.
- **Thread Workspace**: When clicking an email, the agent sees a 3-pane workspace:
  1. **The content**: The raw email and any drafts the AI prepared.
  2. **The trace**: The full reasoning trace (Thought/Action) showing *why* the AI made its decisions.
  3. **The context**: Side panels showing the user's CRM profile, churn risk, and the specific RAG policy snippets the AI referenced.
- **Manual Intervention**: The human agent can edit the AI's draft, approve it, or manually reply. Every mutation writes a differential log directly to the `AuditLog` table.
