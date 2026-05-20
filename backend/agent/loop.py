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
    
    # 2. Hard check for spam
    if email.is_spam:
        if not dry_run:
            action = Action(email_id=email_id, action_type="Ignored", escalation_reason="Spam Pre-filter")
            db.add(action)
            await db.commit()
        return {"status": "success", "message": "Ignored due to spam flags"}
        
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
