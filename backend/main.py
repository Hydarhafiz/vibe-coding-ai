# backend-vibe-coder/main.py
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import httpx # For making async HTTP requests to Ollama
import os
from dotenv import load_dotenv

from . import models, schemas, crud
from .database import engine, get_db, Base # Import Base for initial table creation if not using Alembic initially

# Load environment variables
load_dotenv()

app = FastAPI()

# --- CORS Configuration ---
# Adjust this for production. For local development, allow all origins.
origins = [
    "http://localhost:5173",  # Your React frontend dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Initialization (for first run without Alembic) ---
# In a production setup, you'd rely on Alembic migrations.
# For quick local testing, you can uncomment this to create tables automatically.
# @app.on_event("startup")
# def create_db_tables():
#     Base.metadata.create_all(bind=engine)

# --- Ollama Configuration ---
OLLAMA_BASE_URL = "http://localhost:11434/api/generate"

async def call_ollama(model: str, system_prompt: str, chat_history: list, user_message: str):
    """
    Calls the Ollama API with the given model, prompt, and history.
    """
    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history: # Add existing chat history
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": model,
        "prompt": user_message, # Ollama takes the last message in 'prompt' field or 'messages' list
        "stream": False,
        "messages": messages # Use the messages list for conversational context
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(OLLAMA_BASE_URL, json=payload, timeout=300.0) # Increased timeout
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            data = response.json()
            return data.get("response", data.get("message", "No response content from LLM.")) # Ollama response format can vary
    except httpx.RequestError as exc:
        raise HTTPException(status_code=500, detail=f"Ollama request failed: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Ollama API error: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


# --- Routes ---

# Project Creation
@app.post("/projects/", response_model=schemas.Project, status_code=status.HTTP_201_CREATED)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    # For now, we'll use a placeholder user_id. In a real app, this comes from authentication.
    # For the interview context, this can be the `__app_id` + `_` + `user_id` from the frontend if applicable.
    # Or, for simplicity, a fixed 'demo_user_123' if your authentication isn't fully set up yet.
    # Let's use a simplified user ID for now.
    user_id_placeholder = os.getenv("FIREBASE_APP_ID", "default_app_id") + "_demo_user" # Example if Firebase auth isn't fully integrated here
    return crud.create_project(db=db, project=project, user_id=user_id_placeholder)

# Get all projects for a user
@app.get("/projects/", response_model=List[schemas.Project])
def read_projects(db: Session = Depends(get_db)):
    user_id_placeholder = os.getenv("FIREBASE_APP_ID", "default_app_id") + "_demo_user"
    projects = crud.get_projects_by_user(db=db, user_id=user_id_placeholder)
    return projects

# Main chat endpoint with LLM routing
@app.post("/chat/", response_model=schemas.Message)
async def chat_with_ai(chat_request: schemas.ChatRequest, db: Session = Depends(get_db)):
    project_id = chat_request.project_id
    user_message = chat_request.message_content
    action = chat_request.action
    programming_language = chat_request.programming_language
    chat_history = chat_request.chat_history

    # Save user's message immediately
    crud.create_message(db, schemas.MessageCreate(content=user_message, role="user"), project_id)

    llm_response_content = ""
    llm_role = "assistant" # Default role for generated code

    if action == "generate_code":
        model_name = "qwen:7b-chat" # Ensure this model is pulled in Ollama
        system_prompt = (
            f"You are a helpful coding assistant specializing in {programming_language}. "
            f"Generate clean, well-commented, and functional code for the user's request. "
            f"Always provide runnable code blocks. If the user asks for a specific feature, provide the code for that feature directly."
        )
        llm_response_content = await call_ollama(model_name, system_prompt, chat_history, user_message)

    elif action == "analyze_code":
        model_name = "llama3:8b" # Ensure this model is pulled in Ollama
        system_prompt = (
            f"You are an expert code analyst for {programming_language}. "
            f"Provide a concise and insightful analysis of the following code snippet. "
            f"Focus on potential bugs, best practices, performance considerations, and areas for improvement. "
            f"Present your analysis in clear, easy-to-read markdown format (e.g., bullet points)."
        )
        llm_response_content = await call_ollama(model_name, system_prompt, chat_history, user_message) # user_message here is the code to analyze
        llm_role = "analysis" # Mark this as an analysis response

    elif action == "summarize_chat":
        model_name = "llama3:8b" # Ensure this model is pulled in Ollama
        system_prompt = (
            "You are a chat summarization expert. "
            "Summarize the entire provided chat history (user and assistant messages) into a concise bullet-point list of key topics and generated code snippets."
        )
        # For summarization, the 'user_message' passed to Ollama should be the concatenated chat history
        full_chat_text = "\n".join([f"{msg.role}: {msg.content}" for msg in chat_history])
        llm_response_content = await call_ollama(model_name, system_prompt, [], full_chat_text) # Don't send chat_history as messages for summarization, send as prompt
        llm_role = "summary" # Mark this as a summary response

    else:
        raise HTTPException(status_code=400, detail="Invalid action specified.")

    # Save LLM's response
    ai_message = crud.create_message(db, schemas.MessageCreate(content=llm_response_content, role=llm_role), project_id)

    # Return the AI message to the frontend
    return schemas.Message.from_orm(ai_message)