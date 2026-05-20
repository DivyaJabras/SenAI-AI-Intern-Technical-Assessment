from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional, Dict, Any

class EmailIngestRequest(BaseModel):
    message_id: str
    sender: EmailStr
    subject: str
    body: str
    timestamp: datetime
    thread_id: str

    @field_validator('body')
    @classmethod
    def check_body(cls, v: str) -> str:
        # Normalize whitespace-only to empty string
        if not v or v.isspace():
            return ""
        # Truncate over 10,000 chars to 8,000 + note
        if len(v) > 10000:
            return v[:8000] + "\n...[TRUNCATED FOR LENGTH]"
        return v

class ErrorEnvelope(BaseModel):
    status: str = "error"
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None

class SuccessEnvelope(BaseModel):
    status: str = "success"
    data: Dict[str, Any]
