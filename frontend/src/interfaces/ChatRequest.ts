// frontend/src/interfaces/ChatRequest.ts
export interface ChatRequest {
    project_id: number;
    user_id: string;
    message_content: string;
    programming_language: string;
    chat_history: { content: string; role: string; }[];
    current_code?: string;
}