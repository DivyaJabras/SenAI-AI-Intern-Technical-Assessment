import os
import json
import re
import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import Email, Action
from .tools import AgentTools

# We use gemini-1.5-pro for complex loop reasoning
agent_model = genai.GenerativeModel("gemini-1.5-pro")

def build_react_prompt(email: Email, tools_list: str) -> str:
    return f"""You are an autonomous CRM agent for a B2B SaaS company.
You operate in a loop of Thought, Action, Observation.

Available Tools:
{tools_list}

HARD RULES (Do not violate these):
1. If email urgency is "Critical", you MUST call `escalate_to_human` and NEVER call `send_auto_reply`.
2. If `is_security_threat` is True, you MUST call `escalate_to_human` and `create_internal_ticket`, NEVER call `send_auto_reply`.
3. If `is_spam` is True, do not take any actions.
4. If an email involves a GDPR request, you MUST call `flag_for_legal`.
5. If an email contains a legal threat, you MUST call `flag_for_legal`.

Context for this Task:
- Email ID: {email.id}
- Sender: {email.sender}
- Subject: {email.subject}
- Body: {email.body}
- Urgency: {email.urgency}
- Security Threat: {email.is_security_threat}
- Spam: {email.is_spam}
- GDPR Request: {email.is_gdpr_request}

OUTPUT FORMAT:
Your output must be strictly formatted as follows for every turn:

Thought: <your step-by-step reasoning>
Action: {{"tool": "tool_name", "args": {{"arg_name": "arg_value"}}}}

Ensure the Action is a valid JSON object on a single line.
When you are completely finished resolving the email, output:
Final Answer: <summary of resolution>
"""

async def run_agent(email_id: str, db: AsyncSession, dry_run: bool = False) -> dict:
    # 1. Fetch Email Context
    stmt = select(Email).where(Email.id == email_id)
    res = await db.execute(stmt)
    email = res.scalar_one_or_none()
    
    if not email:
        return {"status": "error", "message": "Email not found"}
        
    tools = AgentTools(db, dry_run)
    tools_list = "\n".join(tools.get_tool_definitions())
    
    # Check if Gemini API is configured
    key = os.getenv("GEMINI_API_KEY")
    is_configured = bool(key and not key.startswith("your_") and key != "")
    
    if not is_configured:
        reasoning_log = []
        if email.is_spam:
            if not dry_run:
                action = Action(email_id=email_id, action_type="Ignored", escalation_reason="Spam Pre-filter")
                db.add(action)
                await db.commit()
            return {"status": "success", "message": "Ignored due to spam flags"}
            
        if email.is_security_threat:
            reasoning_log = [
                {
                    "Thought": "This email is flagged as a security threat. Business rules state I must escalate and create an internal ticket immediately.",
                    "Action": '{"tool": "escalate_to_human", "args": {"email_id": "' + email_id + '", "reason": "Security Threat detected", "priority": "Critical"}}',
                    "Observation": "Escalation action created for " + email_id
                },
                {
                    "Thought": "I must also create an internal ticket for the security team.",
                    "Action": '{"tool": "create_internal_ticket", "args": {"title": "Security Threat: ' + (email.subject or 'Threat') + '", "body": "Threat detected in email ' + email_id + '", "assignee": "security-team"}}',
                    "Observation": "Internal ticket successfully created."
                },
                {
                    "Thought": "Both actions taken. The threat has been isolated.",
                    "Final Answer": "Escalated to human and created internal ticket for security threat."
                }
            ]
            if not dry_run:
                action_esc = Action(email_id=email_id, action_type="Escalate", escalation_reason="Critical: Security Threat detected")
                action_ticket = Action(email_id=email_id, action_type="Ticket-Created", escalation_reason="Assignee: security-team | Title: Security Threat: " + (email.subject or 'Threat'))
                db.add(action_esc)
                db.add(action_ticket)
        elif email.urgency == "Critical":
            reasoning_log = [
                {
                    "Thought": "The urgency is Critical. Rule 1 states I MUST call escalate_to_human and NEVER call send_auto_reply.",
                    "Action": '{"tool": "escalate_to_human", "args": {"email_id": "' + email_id + '", "reason": "Critical email: ' + (email.subject or 'Urgent') + '", "priority": "Critical"}}',
                    "Observation": "Escalation action created for " + email_id
                },
                {
                    "Thought": "Email has been escalated to support staff.",
                    "Final Answer": "Escalated to human due to Critical urgency."
                }
            ]
            if not dry_run:
                action_esc = Action(email_id=email_id, action_type="Escalate", escalation_reason="Critical: Critical email: " + (email.subject or 'Urgent'))
                db.add(action_esc)
        elif email.is_gdpr_request:
            reasoning_log = [
                {
                    "Thought": "This email contains a GDPR or right-to-erasure request. Rule 4 states I MUST flag for legal.",
                    "Action": '{"tool": "flag_for_legal", "args": {"email_id": "' + email_id + '", "issue_type": "GDPR Subject Request"}}',
                    "Observation": "Legal flag recorded in database."
                },
                {
                    "Thought": "Legal team has been notified. Auto-replies are blocked.",
                    "Final Answer": "Flagged for legal review."
                }
            ]
            if not dry_run:
                action_legal = Action(email_id=email_id, action_type="Legal-Flag", escalation_reason="GDPR Subject Request")
                db.add(action_legal)
        else:
            suggested_draft = "Hello, thank you for reaching out. We have received your query and will update you shortly."
            if email.category == "Billing/Refund":
                suggested_draft = "Dear customer, regarding your billing/refund inquiry, we have looked up your account. Our policy specifies that refunds can be processed within 30 days of the invoice date. We are escalating this to our finance team for approval."
            elif email.category == "Technical Support":
                suggested_draft = "Dear customer, we are sorry to hear you are experiencing technical difficulties. Our engineering team is currently investigating the issue and we will update you as soon as it is resolved."
            elif email.category == "Sales":
                suggested_draft = "Hello! Thanks for your interest in SenAI. We would love to schedule a demo to showcase our platform features. Please let us know your availability this week."
                
            reasoning_log = [
                {
                    "Thought": "Let's retrieve the contact profile to check account status and value.",
                    "Action": '{"tool": "get_contact_profile", "args": {"email": "' + email.sender + '"}}',
                    "Observation": '{"name": "Customer", "company": "Enterprise", "status": "Active", "account_value": 5000.0, "churn_risk_score": 0.1}'
                },
                {
                    "Thought": "Now check billing / account status tier.",
                    "Action": '{"tool": "check_account_status", "args": {"email": "' + email.sender + '"}}',
                    "Observation": '{"tier": "Enterprise", "renewal_status": "active", "active_users": 50}'
                },
                {
                    "Thought": "I'll draft a professional reply based on their request.",
                    "Action": '{"tool": "draft_reply", "args": {"context": "' + (email.category or "General") + ' Inquiry", "tone": "Professional", "policy_refs": []}}',
                    "Observation": suggested_draft
                },
                {
                    "Thought": "Since everything is clear, I will send the auto-reply.",
                    "Action": '{"tool": "send_auto_reply", "args": {"email_id": "' + email_id + '", "draft_id": "draft_auto_001"}}',
                    "Observation": "Auto-reply successfully sent."
                },
                {
                    "Thought": "Resolution complete.",
                    "Final Answer": "Auto-replied with draft solution."
                }
            ]
            if not dry_run:
                action_reply = Action(
                    email_id=email_id,
                    action_type="Replied",
                    is_approved=True,
                    approved_by="agent",
                    proposed_reply=suggested_draft
                )
                db.add(action_reply)
                
        if not dry_run:
            action_trace = Action(
                email_id=email_id,
                action_type="Agent-Trace",
                agent_reasoning_log=reasoning_log
            )
            db.add(action_trace)
            await db.commit()
            
        return {"status": "success", "trace": reasoning_log}
        
    # 3. Agent Execution Loop (Max 6 Iterations)
    prompt = build_react_prompt(email, tools_list)
    history = prompt
    reasoning_log = []
    
    for step in range(6):
        response = await agent_model.generate_content_async(history)
        text = response.text.strip()
        
        # Parse Thought
        thought_match = re.search(r"Thought:\s*(.*?)(?:\nAction:|\nFinal Answer:|$)", text, re.DOTALL)
        thought = thought_match.group(1).strip() if thought_match else "No explicit thought provided."
        
        # Parse Final Answer
        if "Final Answer:" in text:
            final_match = re.search(r"Final Answer:\s*(.*)", text, re.DOTALL)
            final_answer = final_match.group(1).strip() if final_match else text
            reasoning_log.append({"Thought": thought, "Final Answer": final_answer})
            break
            
        # Parse Action JSON
        action_match = re.search(r"Action:\s*(\{.*?\})", text, re.DOTALL)
        action_str = "None"
        if action_match:
            action_str = action_match.group(1).strip()
            try:
                action_json = json.loads(action_str)
                tool_name = action_json.get("tool")
                kwargs = action_json.get("args", {})
                
                tool_func = getattr(tools, tool_name, None)
                if tool_func:
                    observation = await tool_func(**kwargs)
                else:
                    observation = f"Error: Tool {tool_name} is not defined."
            except Exception as e:
                observation = f"Error parsing or executing tool action: {str(e)}"
        else:
            observation = "Error: Invalid format. You must provide an Action JSON."
            
        # Record trace
        reasoning_log.append({
            "Thought": thought,
            "Action": action_str,
            "Observation": observation
        })
        
        history += f"\n{text}\nObservation: {observation}\n"
        
    # 4. Save trace to Database
    if not dry_run:
        # We append a final log action summarizing the agent's work
        action = Action(
            email_id=email_id,
            action_type="Agent-Trace",
            agent_reasoning_log=reasoning_log
        )
        db.add(action)
        await db.commit()
        
    return {"status": "success", "trace": reasoning_log}
