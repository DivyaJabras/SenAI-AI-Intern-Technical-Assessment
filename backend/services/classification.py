import os
import json
import google.generativeai as genai
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

# Initialize Gemini SDK
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# We use gemini-1.5-pro for complex reasoning and structured JSON output
classification_config = {
    "temperature": 0.1,
    "response_mime_type": "application/json",
}
classifier_model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite",
    generation_config=classification_config
)

# We use gemini-1.5-flash for the fast query formulation step
fast_model = genai.GenerativeModel(model_name="gemini-1.5-flash")

SYSTEM_PROMPT = """You are a professional CRM intelligence system for a B2B SaaS company.
Your job is to analyze incoming customer emails and classify them accurately.

CRITICAL DEFINITIONS:
- Urgency "Critical": The issue is causing active financial loss, involves a legal or security threat, or risks immediate customer churn.
- Urgency "High": The issue is a major blocker for the customer's workflow but not an active existential threat.
- Urgency "Medium": Standard inquiries, billing questions, or minor bugs.
- Urgency "Low": Feature requests, general feedback, or casual chatter.
- Sentiment: Must be "Positive", "Neutral", "Mixed", or "Negative".
- Sentiment Score: -1.0 (extremely negative) to 1.0 (extremely positive).

CONFLICTING SIGNALS RULE:
If the email contains conflicting signals (e.g., positive sentiment about the product combined with a refund request), classify the **primary business intent** as the category (e.g., "Billing/Complaint" or "Refund"), weight the sentiment toward the most actionable signal, and set confidence below 0.80 to flag for review.

OUTPUT SCHEMA REQUIREMENTS (JSON ONLY):
{
  "category": "string",
  "sentiment": "string",
  "sentiment_score": float,
  "urgency": "string",
  "requires_human": boolean,
  "escalation_reason": "string or null",
  "suggested_reply": "string or null",
  "confidence": float,
  "detected_entities": {"key": "value"}
}

Respond ONLY with a valid JSON object matching this schema. Do not include markdown blocks or any other text.
"""

def build_prompt(email_subject: str, email_body: str, thread_history: List[Dict[str, str]], rag_context: List[Dict[str, Any]]) -> str:
    prompt = SYSTEM_PROMPT + "\n\n"
    
    prompt += "--- THREAD HISTORY ---\n"
    if not thread_history:
        prompt += "No prior thread history.\n"
    else:
        for msg in thread_history:
            prompt += f"[{msg['timestamp']}] {msg['sender']}: {msg['body']}\n"
            
    prompt += "\n--- INTERNAL KNOWLEDGE BASE CONTEXT ---\n"
    if not rag_context:
        prompt += "No relevant internal context retrieved.\n"
    else:
        for chunk in rag_context:
            prompt += f"Source: {chunk['source_doc']} (Relevance: {chunk['score']:.2f})\nContent: {chunk['chunk_text']}\n\n"
            
    prompt += "\n--- CURRENT EMAIL TO CLASSIFY ---\n"
    prompt += f"Subject: {email_subject}\n"
    prompt += f"Body: {email_body}\n"
    
    return prompt

async def generate_search_query(email_subject: str, email_body: str) -> str:
    """Uses a fast LLM call to generate a concise search query for the RAG pipeline."""
    prompt = (
        "Given the following customer email, generate a concise search query (3-6 words) "
        "to search our internal knowledge base for policies that would help answer this email. "
        "Reply with ONLY the search query string, no quotes.\n\n"
        f"Subject: {email_subject}\nBody: {email_body}"
    )
    try:
        response = await fast_model.generate_content_async(prompt)
        return response.text.strip()
    except Exception:
        # Fallback to subject if API call fails
        return email_subject

async def classify_email(
    email_subject: str, 
    email_body: str, 
    thread_history: List[Dict[str, str]], 
    rag_context: List[Dict[str, Any]],
    retries: int = 1
) -> Dict[str, Any]:
    """Runs the main LLM classification engine."""
    prompt = build_prompt(email_subject, email_body, thread_history, rag_context)
    
    for attempt in range(retries + 1):
        try:
            response = await classifier_model.generate_content_async(prompt)
            result_json = response.text.strip()
            
            # Clean up markdown JSON block if the model accidentally included it
            if result_json.startswith("```json"):
                result_json = result_json[7:-3].strip()
            
            parsed = json.loads(result_json)
            
            # HARD RULE: Enforce requires_human for low confidence
            if parsed.get("confidence", 1.0) < 0.70:
                parsed["requires_human"] = True
                
            return parsed
            
        except (json.JSONDecodeError, Exception) as e:
            if attempt == retries:
                # Fallback on total failure
                return {
                    "category": "Unknown",
                    "sentiment": "Neutral",
                    "sentiment_score": 0.0,
                    "urgency": "Medium",
                    "requires_human": True,
                    "escalation_reason": "Failed to parse LLM classification output.",
                    "suggested_reply": None,
                    "confidence": 0.0,
                    "detected_entities": {}
                }
            
            # Append retry instruction
            prompt += "\n\nYour previous response was not valid JSON. Respond ONLY with the JSON object."
