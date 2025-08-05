# backend/app/services/chat_service.py
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
    action = chat_request.action # Now the action controls the workflow type

    # Save user's message immediately
    user_message_db = crud.create_message(
        db,
        schemas.MessageCreate(content=user_message_content, role="user"),
        project_id
    )

    new_messages: List[schemas.Message] = [schemas.Message.from_orm(user_message_db)]

    if action == "generate_and_analyze":
        # Get the LLM models and prompts
        code_gen_model = os.getenv("QWEN_CODE_GEN_MODEL", "qwen:7b-chat")
        analyze_model = os.getenv("LLAMA_ANALYZE_MODEL", "llama3:8b")

        try:
            # 1. Generate the code with the first LLM
            # The prompt includes chat history for context
            generate_prompt = prompts.generate_code_prompt(programming_language)
            generated_code = await call_ollama(
                code_gen_model,
                system_prompt=generate_prompt,
                chat_history=chat_history,
                user_message=user_message_content
            )

            # 2. Analyze the generated code with the second LLM
            # The prompt for analysis is the generated code itself
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

    elif action == "summarize_chat":
        # Keep the summary logic as a separate, one-off action
        model_name = os.getenv("LLAMA_SUMMARY_MODEL", "llama3:8b")
        system_prompt = prompts.summarize_chat_prompt()
        full_chat_text = "\n".join([f"{msg.role}: {msg.content}" for msg in chat_history])
        
        if not full_chat_text:
            llm_response_content = "No chat history available to summarize."
        else:
            llm_response_content = await call_ollama(model_name, system_prompt, [], full_chat_text)
        
        ai_message_db = crud.create_message(
            db,
            schemas.MessageCreate(content=llm_response_content, role="summary"),
            project_id
        )
        new_messages.append(schemas.Message.from_orm(ai_message_db))
        return new_messages

    elif action == "analyze_code_only":
        # This is for when the user wants to analyze the code from the editor, not generate new code
        if not current_code:
            error_message = "No code provided for analysis."
            error_msg_db = crud.create_message(
                db, schemas.MessageCreate(content=error_message, role="assistant"), project_id
            )
            new_messages.append(schemas.Message.from_orm(error_msg_db))
            return new_messages
        
        analyze_model = os.getenv("LLAMA_ANALYZE_MODEL", "llama3:8b")
        analysis_prompt = prompts.analyze_code_prompt(programming_language)
        analysis_response = await call_ollama(
            analyze_model,
            system_prompt=analysis_prompt,
            chat_history=[],
            user_message=current_code
        )
        
        analysis_message_db = crud.create_message(
            db, schemas.MessageCreate(content=analysis_response, role="analysis"), project_id
        )
        new_messages.append(schemas.Message.from_orm(analysis_message_db))
        return new_messages

    # This part handles follow-up requests to modify existing code
    elif action == "follow_up_modify":
        if not current_code:
            raise HTTPException(status_code=400, detail="Cannot follow up without existing code to modify.")
        
        code_gen_model = os.getenv("QWEN_CODE_GEN_MODEL", "qwen:7b-chat")
        
        # Combine the user's new request with the existing code for context
        user_message_with_code = f"Here is the current code:\n```\n{current_code}\n```\n\nUser request: {user_message_content}"
        
        try:
            generate_prompt = prompts.generate_code_prompt(programming_language)
            modified_code = await call_ollama(
                code_gen_model,
                system_prompt=generate_prompt,
                chat_history=chat_history,
                user_message=user_message_with_code
            )
            
            # Analyze the new code
            analyze_model = os.getenv("LLAMA_ANALYZE_MODEL", "llama3:8b")
            analysis_prompt = prompts.analyze_code_prompt(programming_language)
            analysis_response = await call_ollama(
                analyze_model,
                system_prompt=analysis_prompt,
                chat_history=[],
                user_message=modified_code
            )
            
            code_message_db = crud.create_message(
                db, schemas.MessageCreate(content=modified_code, role="assistant"), project_id
            )
            new_messages.append(schemas.Message.from_orm(code_message_db))

            analysis_message_db = crud.create_message(
                db, schemas.MessageCreate(content=analysis_response, role="analysis"), project_id
            )
            new_messages.append(schemas.Message.from_orm(analysis_message_db))
            
            return new_messages
            
        except Exception as e:
            error_message = f"An error occurred during code modification: {str(e)}"
            error_msg_db = crud.create_message(
                db, schemas.MessageCreate(content=error_message, role="assistant"), project_id
            )
            new_messages.append(schemas.Message.from_orm(error_msg_db))
            return new_messages

    else:
        raise HTTPException(status_code=400, detail="Invalid action specified.")