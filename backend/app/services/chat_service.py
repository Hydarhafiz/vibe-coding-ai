from sqlalchemy.orm import Session
from typing import List, Tuple
import os
from fastapi import HTTPException
import asyncio

from app.models import schemas
from app.services import crud # Import CRUD operations
from app.services.llm_service import call_ollama # Import the Ollama calling function
from app.utils import prompts # Import system prompts

async def handle_chat_request(db: Session, chat_request: schemas.ChatRequest) -> List[schemas.Message]:
    """
    Handles a comprehensive chat request with a single, smart workflow.
    It orchestrates multiple LLM calls (generate, then analyze) for a single user prompt.
    Returns a list of new messages to be displayed in the frontend.
    """
    project_id = chat_request.project_id
    user_message_content = chat_request.message_content
    programming_language = chat_request.programming_language
    chat_history = chat_request.chat_history
    current_code = chat_request.current_code

    # Get the LLM models and prompts
    code_gen_model = os.getenv("QWEN_CODE_GEN_MODEL", "qwen:7b-chat")
    analyze_model = os.getenv("LLAMA_ANALYZE_MODEL", "llama3:8b")

    # Save user's message immediately
    user_message_db = crud.create_message(
        db,
        schemas.MessageCreate(content=user_message_content, role="user"),
        project_id
    )

    new_messages: List[schemas.Message] = [schemas.Message.from_orm(user_message_db)]

    try:
        # Check if the user is providing a prompt to modify existing code
        if current_code and user_message_content.strip():
            # Scenario: User wants to modify existing code
            user_prompt_with_code = f"Here is the current code:\n```\n{current_code}\n```\n\nUser request: {user_message_content}"
            generated_code = await call_ollama(
                code_gen_model,
                system_prompt=prompts.generate_code_prompt(programming_language),
                chat_history=chat_history,
                user_message=user_prompt_with_code
            )
        else:
            # Scenario: User wants to generate new code from scratch
            generated_code = await call_ollama(
                code_gen_model,
                system_prompt=prompts.generate_code_prompt(programming_language),
                chat_history=chat_history,
                user_message=user_message_content
            )

        # 2. Analyze the generated/modified code with the second LLM
        analysis_prompt = prompts.analyze_code_prompt(programming_language)
        analysis_response = await call_ollama(
            analyze_model,
            system_prompt=analysis_prompt,
            chat_history=[], # No need for full chat history here, the code is the context
            user_message=generated_code
        )

        # 3. Save and return both messages
        # Save the generated code
        code_message_db = crud.create_message(
            db,
            schemas.MessageCreate(content=generated_code, role="assistant"),
            project_id
        )
        new_messages.append(schemas.Message.from_orm(code_message_db))

        # Save the analysis message
        analysis_message_db = crud.create_message(
            db,
            schemas.MessageCreate(content=analysis_response, role="analysis"),
            project_id
        )
        new_messages.append(schemas.Message.from_orm(analysis_message_db))
        
        return new_messages

    except Exception as e:
        # Handle potential errors during the multi-step process
        error_message = f"An error occurred during code generation and analysis: {str(e)}"
        error_msg_db = crud.create_message(
            db,
            schemas.MessageCreate(content=error_message, role="assistant"),
            project_id
        )
        new_messages.append(schemas.Message.from_orm(error_msg_db))
        return new_messages