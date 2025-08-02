# backend/app/services/chat_service.py
from sqlalchemy.orm import Session
from typing import List
import os
from fastapi import HTTPException

from app.models import schemas
from app.services import crud # Import CRUD operations
from app.services.llm_service import call_ollama # Import the Ollama calling function
from app.utils import prompts # Import system prompts

async def handle_chat_request(db: Session, chat_request: schemas.ChatRequest):
    """
    Handles different chat actions (code generation, analysis, summarization)
    by calling the appropriate LLM and saving messages.
    """
    project_id = chat_request.project_id
    user_id = chat_request.user_id # Get user_id from chat_request
    user_message = chat_request.message_content
    action = chat_request.action
    programming_language = chat_request.programming_language
    chat_history = chat_request.chat_history

    # Save user's message immediately
    # Note: crud.create_message only needs MessageCreate schema and project_id
    crud.create_message(
        db,
        schemas.MessageCreate(content=user_message, role="user"),
        project_id
    )

    llm_response_content = ""
    llm_role = "assistant" # Default role for generated code

    if action == "generate_code":
        if not programming_language:
            raise HTTPException(status_code=400, detail="Programming language is required for code generation.")
        model_name = os.getenv("QWEN_CODE_GEN_MODEL", "qwen:7b-chat")
        system_prompt = prompts.generate_code_prompt(programming_language)
        # Pass the full chat history and the current user message
        llm_response_content = await call_ollama(model_name, system_prompt, chat_history, user_message)

    elif action == "analyze_code":
        if not programming_language:
            raise HTTPException(status_code=400, detail="Programming language is required for code analysis.")
        model_name = os.getenv("LLAMA_ANALYZE_MODEL", "llama3:8b")
        system_prompt = prompts.analyze_code_prompt(programming_language)
        # For analysis, user_message is typically the code to analyze.
        # We might not want to send the entire chat history for analysis to keep the prompt focused.
        # If the model benefits from history, you can include it. For now, empty list for history.
        llm_response_content = await call_ollama(model_name, system_prompt, [], user_message)
        llm_role = "analysis"

    elif action == "summarize_chat":
        model_name = os.getenv("LLAMA_SUMMARY_MODEL", "llama3:8b")
        system_prompt = prompts.summarize_chat_prompt()
        # For summarization, the 'user_message' is usually the *entire* chat history concatenated.
        # The 'chat_history' parameter to call_ollama will be an empty list as the user_message contains the history.
        # It's better to pass only the system prompt and the concatenated chat history as the 'user_message' to Ollama.
        full_chat_text = "\n".join([f"{msg.role}: {msg.content}" for msg in chat_history])
        if not full_chat_text: # If chat history is empty, nothing to summarize
            llm_response_content = "No chat history available to summarize."
        else:
            # When summarizing, the 'user_message' to Ollama should be the full chat to summarize.
            # The 'chat_history' to Ollama should be empty as the 'user_message' is the context.
            llm_response_content = await call_ollama(model_name, system_prompt, [], full_chat_text)
        llm_role = "summary"

    else:
        raise HTTPException(status_code=400, detail="Invalid action specified.")

    # Save LLM's response
    ai_message_db = crud.create_message(
        db,
        schemas.MessageCreate(content=llm_response_content, role=llm_role),
        project_id
    )

    # Return the AI message to the frontend (as a Pydantic model)
    return schemas.Message.from_orm(ai_message_db)