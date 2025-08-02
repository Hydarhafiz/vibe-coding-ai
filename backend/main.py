# backend/main.py
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session # Keep for dependency injection

# Load environment variables early
load_dotenv()

# Import sub-modules relative to 'app'
from app.database import engine, Base # Base is imported if you decide to use Base.metadata.create_all
from app.api import endpoints # Consolidated all API routes here

app = FastAPI(
    title="Vibe Coder Backend API",
    description="API for the Vibe Coding AI Assistant, integrating Ollama and PostgreSQL.",
    version="0.1.0"
)

# --- CORS Configuration ---
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"), # Get frontend URL from env
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Initialization on Startup ---
# For a production setup, Alembic is preferred. For a quick demo/dev, Base.metadata.create_all can be used.
@app.on_event("startup")
async def startup_event():
    # If you want to automatically create tables on startup for dev/testing:
    # Base.metadata.create_all(bind=engine)
    print("FastAPI application started.")
    # You might also want to log which models are being used
    print(f"Code Gen Model: {os.getenv('QWEN_CODE_GEN_MODEL')}")
    print(f"Analyze Model: {os.getenv('LLAMA_ANALYZE_MODEL')}")
    print(f"Summary Model: {os.getenv('LLAMA_SUMMARY_MODEL')}")

@app.on_event("shutdown")
async def shutdown_event():
    print("FastAPI application shutting down.")
    # Add any cleanup code here if necessary, though SQLAlchemy handles sessions.

# Include API router from app.api.endpoints
app.include_router(endpoints.router) # No prefix needed or use "/api" if you want all API routes under /api

# Basic health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Backend is running and healthy"}