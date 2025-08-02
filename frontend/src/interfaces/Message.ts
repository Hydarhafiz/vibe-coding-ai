export interface Message {
  id: number;
  project_id: number;
  role: 'user' | 'assistant' | 'analysis' | 'summary';
  content: string;
  created_at: string; // ISO 8601 string
}