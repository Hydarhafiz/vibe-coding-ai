# backend/app/services/llm_service.py
import httpx
import os
from fastapi import HTTPException

# Ollama Chat API endpoint. Typically it's /api/chat for conversational models.
# If you explicitly want /api/generate, ensure your payload is adjusted.
OLLAMA_CHAT_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434") + "/api/chat"

async def call_ollama(model: str, system_prompt: str, chat_history: list, user_message: str):
    """
    Calls the Ollama API's /api/chat endpoint with the given model, system prompt, and conversation history.
    """
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Add existing chat history from the frontend.
    # Ensure these messages align with Ollama's expected format (role: user/assistant, content: string).
    for msg in chat_history:
        messages.append({"role": msg.role, "content": msg.content})

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False, # Set to False for single response, True for streaming
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(OLLAMA_CHAT_URL, json=payload, timeout=300.0)
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            data = response.json()

            # Ollama's /api/chat response format (when stream: False):
            # { "model": "...", "created_at": "...", "message": { "role": "assistant", "content": "..." }, "done": true, ... }
            if 'message' in data and 'content' in data['message']:
                return data['message']['content']
            else:
                # Fallback or error if the expected structure isn't found
                raise HTTPException(status_code=500, detail="Ollama response missing expected 'message.content'.")

    except httpx.RequestError as exc:
        raise HTTPException(status_code=500, detail=f"Ollama request failed: {exc} - Is Ollama running and model pulled? Check OLLAMA_BASE_URL: {OLLAMA_CHAT_URL}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Ollama API error: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during Ollama call: {str(e)}")