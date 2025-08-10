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
        from_attributes = True

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
        from_attributes = True

class ChatRequest(BaseModel):
    project_id: int
    user_id: str
    message_content: str
    # The action field is no longer needed since there's one workflow
    programming_language: str
    chat_history: List[MessageBase] = []
    # Add a field to hold the current code from the editor
    current_code: Optional[str] = None