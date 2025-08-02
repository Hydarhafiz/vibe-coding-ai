export interface MessageBase {
  content: string;
  role: 'user' | 'assistant' | 'analysis' | 'summary';
}