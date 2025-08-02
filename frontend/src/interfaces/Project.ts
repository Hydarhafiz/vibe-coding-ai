export interface Project {
  id: number;
  user_id: string;
  project_name: string;
  programming_language: string;
  created_at: string; // ISO 8601 string from backend datetime
  updated_at: string; // ISO 8601 string
}