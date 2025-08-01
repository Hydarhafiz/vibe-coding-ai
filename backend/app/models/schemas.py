# backend/app/models/schemas.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProjectBase(BaseModel):
    project_name: str
    programming_language: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True # Use orm_mode=True for older Pydantic versions

class MessageBase(BaseModel):
    content: str
    role: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True # Use orm_mode=True for older Pydantic versions

class ChatRequest(BaseModel):
    project_id: int
    user_id: str
    message_content: str
    action: str # 'generate_code', 'analyze_code', 'summarize_chat'
    programming_language: str
    chat_history: List[MessageBase] = [] # For sending context to LLM