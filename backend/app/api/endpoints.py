# backend/app/api/endpoints.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import os # For accessing environment variables

from app.models import schemas, models
from app.services import crud as service_crud # Renamed to avoid confusion with 'service' module
from app.services import chat_service # New service for handling chat logic and LLM calls
from app.database import get_db

router = APIRouter()

# --- Project Endpoints ---

@router.post("/projects/", response_model=schemas.Project, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    # User ID for now. In a real app, this comes from an auth dependency.
    # It's better to get a proper user ID from a request header or authentication token.
    # For now, keeping the env var fallback as per your original code.
    user_id = os.getenv("FIREBASE_APP_ID", "default_app_id") + "_demo_user"
    return service_crud.create_project(db=db, project=project, user_id=user_id)

@router.get("/projects/", response_model=List[schemas.Project])
def read_projects_endpoint(db: Session = Depends(get_db)):
    user_id = os.getenv("FIREBASE_APP_ID", "default_app_id") + "_demo_user"
    projects = service_crud.get_projects_by_user(db=db, user_id=user_id)
    return projects

@router.get("/projects/{project_id}", response_model=schemas.Project)
def read_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single project by its ID.
    """
    project = service_crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Optional: Add user_id check if a project should only be accessible by its owner
    # user_id = os.getenv("FIREBASE_APP_ID", "default_app_id") + "_demo_user"
    # if project.user_id != user_id:
    #     raise HTTPException(status_code=403, detail="Not authorized to access this project")
    return project

@router.get("/projects/{project_id}/messages/", response_model=List[schemas.Message])
def read_messages_for_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    messages = service_crud.get_messages_by_project(db=db, project_id=project_id)
    if not messages:
        # If you want to return an empty list when no messages or project exists:
        # return []
        # If you want to raise an error if the project_id itself is not found:
        project = service_crud.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found.")
    return messages


# --- Chat Endpoint ---

@router.post("/chat/", response_model=schemas.Message)
async def chat_with_ai_endpoint(chat_request: schemas.ChatRequest, db: Session = Depends(get_db)):
    """
    Handles a chat request to the AI, orchestrating LLM calls and database interactions.
    """
    try:
        response_message = await chat_service.handle_chat_request(db, chat_request)
        return response_message
    except HTTPException as e:
        raise e # Re-raise FastAPI HTTPExceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during chat: {str(e)}")