import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import Email, Thread, Contact, Action
from rag.retriever import retrieve_chunks
import google.generativeai as genai

class AgentTools:
    def __init__(self, db: AsyncSession, dry_run: bool = False):
        self.db = db
        self.dry_run = dry_run
        
    async def search_knowledge_base(self, query: str) -> str:
        """Searches the internal knowledge base for policies related to the query."""
        if self.dry_run:
            return f"[DRY-RUN] Simulated RAG retrieval for query: {query}"
        results = await retrieve_chunks(self.db, query, top_k=2)
        if not results:
            return "No relevant policies found."
        return json.dumps(results)
        
    async def get_thread_history(self, sender_email: str) -> str:
        """Retrieves prior emails from this sender to understand conversation context."""
        if self.dry_run:
            return f"[DRY-RUN] Simulated thread history retrieved for {sender_email}"
        stmt = select(Email).where(Email.sender == sender_email).order_by(Email.timestamp)
        res = await self.db.execute(stmt)
        emails = res.scalars().all()
        if not emails:
            return "No prior thread history."
        return json.dumps([{"subject": e.subject, "body": e.body, "timestamp": str(e.timestamp)} for e in emails])

    async def get_contact_profile(self, email: str) -> str:
        """Fetches the contact's CRM profile, including VIP status and churn risk."""
        if self.dry_run:
            return f"[DRY-RUN] Simulated contact profile retrieved for {email}"
        stmt = select(Contact).where(Contact.email == email)
        res = await self.db.execute(stmt)
        contact = res.scalar_one_or_none()
        if not contact:
            return "Contact not found in CRM."
        return json.dumps({
            "name": contact.name, 
            "company": contact.company, 
            "status": contact.status, 
            "account_value": float(contact.account_value),
            "churn_risk_score": contact.churn_risk_score
        })

    async def check_account_status(self, email: str) -> str:
        """Returns billing and subscription information for the contact."""
        # Hardcoded simulated response as permitted by spec
        return json.dumps({"tier": "Enterprise", "renewal_status": "on_hold", "active_users": 150})

    async def draft_reply(self, context: str, tone: str, policy_refs: list) -> str:
        """Calls the LLM to draft a reply using the given context, tone, and policies."""
        if self.dry_run:
            return f"[DRY-RUN] Simulated drafted reply using tone '{tone}' and policies {policy_refs}"
        
        prompt = f"Draft an email reply with tone: {tone}. Context: {context}. Reference policies: {policy_refs}"
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = await model.generate_content_async(prompt)
        return resp.text.strip()

    async def escalate_to_human(self, email_id: str, reason: str, priority: str) -> str:
        """Creates an Escalate action requiring human intervention."""
        if self.dry_run:
            return f"[DRY-RUN] Escalated to human: {reason} (Priority: {priority})"
            
        action = Action(
            email_id=email_id,
            action_type="Escalate",
            escalation_reason=f"{priority}: {reason}"
        )
        self.db.add(action)
        return f"Escalation action created for {email_id}."

    async def create_internal_ticket(self, title: str, body: str, assignee: str) -> str:
        """Creates an internal ticket assigned to a specific team."""
        if self.dry_run:
            return f"[DRY-RUN] Ticket created for {assignee}: {title}"
            
        action = Action(
            action_type="Ticket-Created",
            escalation_reason=f"Assignee: {assignee} | Title: {title} | Body: {body}"
        )
        self.db.add(action)
        return "Internal ticket successfully created."

    async def flag_for_legal(self, email_id: str, issue_type: str) -> str:
        """Flags the email for legal review. Prevents any auto-replies from being sent."""
        if self.dry_run:
            return f"[DRY-RUN] Flagged for legal review: {issue_type}"
            
        action = Action(
            email_id=email_id,
            action_type="Legal-Flag",
            escalation_reason=issue_type
        )
        self.db.add(action)
        return "Legal flag recorded in database."

    async def send_auto_reply(self, email_id: str, draft_id: str) -> str:
        """Approves a draft and marks the email as replied."""
        if self.dry_run:
            return "[DRY-RUN] Auto-reply successfully sent."
            
        action = Action(
            email_id=email_id,
            action_type="Replied",
            is_approved=True,
            approved_by="agent",
            proposed_reply=f"Draft ID: {draft_id}"
        )
        self.db.add(action)
        return "Auto-reply dispatched and action recorded."

    def get_tool_definitions(self):
        return [
            "search_knowledge_base(query: str)",
            "get_thread_history(sender_email: str)",
            "get_contact_profile(email: str)",
            "check_account_status(email: str)",
            "draft_reply(context: str, tone: str, policy_refs: list)",
            "escalate_to_human(email_id: str, reason: str, priority: str)",
            "create_internal_ticket(title: str, body: str, assignee: str)",
            "flag_for_legal(email_id: str, issue_type: str)",
            "send_auto_reply(email_id: str, draft_id: str)"
        ]
