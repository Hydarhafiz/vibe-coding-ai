
export interface ChatRequest {
    project_id: number;
    user_id: string;
    message_content: string;
    action: 'generate_and_analyze' | 'analyze_code_only' | 'summarize_chat';
    programming_language: string;
    chat_history: { content: string; role: string; }[];
    current_code?: string;
}