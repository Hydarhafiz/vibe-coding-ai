// frontend/src/services/api.ts
import axios from 'axios';
import type { ProjectCreate } from '../interfaces/ProjectCreate';
import type { Project } from '../interfaces/Project';
import type { Message } from '../interfaces/Message';
import type { ChatRequest } from '../interfaces/ChatRequest';

const API_BASE_URL = '/api'; // Vite proxy will handle routing this to backend

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const projectService = {
  // Create a new project
  createProject: async (projectData: ProjectCreate): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects/', projectData);
    return response.data;
  },

  // Get all projects for a user
  getProjects: async (): Promise<Project[]> => {
    // In a real app, user_id would be passed or derived from a token
    // For now, FastAPI handles a "default_app_id_demo_user" as user_id.
    const response = await apiClient.get<Project[]>('/projects/');
    return response.data;
  },

  getProject: async (projectId: number): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${projectId}`);
    return response.data;
  },

  // Get messages for a specific project
  getMessagesForProject: async (projectId: number): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>(`/projects/${projectId}/messages/`);
    return response.data;
  },
};

export const chatService = {
  // Send a chat request to the AI
  chatWithAI: async (chatRequest: ChatRequest): Promise<Message> => {
    const response = await apiClient.post<Message>('/chat/', chatRequest);
    return response.data;
  },
};