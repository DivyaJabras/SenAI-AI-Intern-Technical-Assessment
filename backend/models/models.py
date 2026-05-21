from sqlalchemy import Column, Integer, String, Text, Numeric, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime, timezone

from .database import Base

class Contact(Base):
    __tablename__ = "contacts"
    
    email = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    company = Column(String, nullable=True)
    status = Column(String, default="Active") # VIP/Blocked/Active/Churned
    account_value = Column(Numeric(10, 2), default=0.0)
    churn_risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    threads = relationship("Thread", back_populates="contact")

class Thread(Base):
    __tablename__ = "threads"
    
    id = Column(String, primary_key=True, index=True)
    subject = Column(String, nullable=True)
    sender_email = Column(String, ForeignKey("contacts.email"), index=True)
    status = Column(String, default="Open") # Open/Resolved/Escalated/Ignored
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    contact = relationship("Contact", back_populates="threads")
    emails = relationship("Email", back_populates="thread")

class Email(Base):
    __tablename__ = "emails"
    
    id = Column(String, primary_key=True) # message_id
    thread_id = Column(String, ForeignKey("threads.id"), index=True)
    sender = Column(String, index=True)
    subject = Column(String)
    body = Column(Text)
    timestamp = Column(DateTime, index=True)
    
    # Classification outputs
    category = Column(String, nullable=True)
    sentiment_score = Column(Float, nullable=True)
    urgency = Column(String, nullable=True)
    requires_human = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True)
    raw_entities = Column(JSONB, nullable=True)
    
    # Heuristic flags
    is_spam = Column(Boolean, default=False)
    is_security_threat = Column(Boolean, default=False)
    is_internal = Column(Boolean, default=False)
    is_urgent = Column(Boolean, default=False)
    is_gdpr_request = Column(Boolean, default=False)
    
    thread = relationship("Thread", back_populates="emails")
    actions = relationship("Action", back_populates="email")

class Action(Base):
    __tablename__ = "actions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(String, ForeignKey("emails.id"))
    action_type = Column(String) # Replied, Escalate, Ticket-Created, Legal-Flag, Ignored
    agent_reasoning_log = Column(JSONB, nullable=True) # Array of Thought/Action/Observation
    proposed_reply = Column(Text, nullable=True)
    escalation_reason = Column(String, nullable=True)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    email = relationship("Email", back_populates="actions")
    
class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_doc = Column(String, index=True)
    chunk_text = Column(Text)
    embedding = Column(Vector(384)) # 384 dimensions for all-MiniLM-L6-v2
    
class WebIntelligenceCache(Base):
    __tablename__ = "web_intelligence_cache"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    target_domain = Column(String, index=True)
    data = Column(JSONB)
    expires_at = Column(DateTime)
    
class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String) # Email, Action, Contact, Thread
    entity_id = Column(String)
    performed_by = Column(String) # "agent" or user_id
    diff = Column(JSONB) 
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
