# backend/app/services/crud.py
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models import models, schemas # Corrected import path

# --- Project CRUD ---
def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def get_projects_by_user(db: Session, user_id: str):
    return db.query(models.Project).filter(models.Project.user_id == user_id).order_by(models.Project.updated_at.desc()).all()

def create_project(db: Session, project: schemas.ProjectCreate, user_id: str):
    db_project = models.Project(
        user_id=user_id,
        project_name=project.project_name,
        programming_language=project.programming_language
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

# --- Message CRUD ---
def get_messages_by_project(db: Session, project_id: int):
    return db.query(models.Message).filter(models.Message.project_id == project_id).order_by(models.Message.created_at).all()

def create_message(db: Session, message: schemas.MessageCreate, project_id: int):
    db_message = models.Message(
        project_id=project_id,
        role=message.role,
        content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message