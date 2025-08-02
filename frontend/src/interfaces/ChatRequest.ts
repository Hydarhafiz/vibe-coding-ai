import type { MessageBase } from "./MessageBase";

export interface ChatRequest {
  project_id: number;
  user_id: string; // Will likely come from auth later, for now a placeholder
  message_content: string;
  action: 'generate_code' | 'analyze_code' | 'summarize_chat';
  programming_language: string;
  chat_history: MessageBase[];
}