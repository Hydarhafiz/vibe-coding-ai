// frontend/src/pages/ProjectDetail/index.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // For getting project ID from URL
import { projectService, chatService } from '../../services/api';
import type { Project } from '../../interfaces/Project';
import type { Message } from '../../interfaces/Message';

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>(); // Get project ID from URL
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parsedProjectId = projectId ? parseInt(projectId) : NaN;

  useEffect(() => {
    if (isNaN(parsedProjectId)) {
      setError('Invalid Project ID.');
      setLoading(false);
      return;
    }
    fetchProjectAndMessages();
  }, [parsedProjectId]);

  const fetchProjectAndMessages = async () => {
    try {
      setLoading(true);
      const fetchedProject = await projectService.getProject(parsedProjectId); // Assuming a getProject in service (needs to be added)
      if (!fetchedProject) {
        throw new Error('Project not found');
      }
      setProject(fetchedProject);

      const fetchedMessages = await projectService.getMessagesForProject(parsedProjectId);
      setMessages(fetchedMessages);
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details or messages.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (action: 'generate_code' | 'analyze_code' | 'summarize_chat') => {
    if (!newMessage.trim() || !project) return;

    // Add user message to state immediately for optimistic UI
    const userMessage: Message = {
      id: Date.now(), // Temp ID for UI
      project_id: parsedProjectId,
      role: 'user',
      content: newMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage(''); // Clear input

    try {
      const chatRequest = {
        project_id: parsedProjectId,
        user_id: import.meta.env.VITE_FIREBASE_APP_ID + "_demo_user", // Placeholder, will get from auth
        message_content: newMessage,
        action: action,
        programming_language: project.programming_language,
        chat_history: messages.map(msg => ({ content: msg.content, role: msg.role })),
      };
      const aiResponse = await chatService.chatWithAI(chatRequest);
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get AI response. Please try again.');
      // Optionally remove the user message if the AI response failed
      setMessages((prev) => prev.filter(msg => msg.id !== userMessage.id));
    }
  };

  if (loading) return <div className="p-4">Loading project...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!project) return <div className="p-4">Project not found.</div>;


  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-64px)]"> {/* Adjust height for header */}
      <h1 className="text-2xl font-bold mb-4">{project.project_name} ({project.programming_language})</h1>

      <div className="flex-grow overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50 flex flex-col space-y-3">
        {messages.length === 0 ? (
          <p className="text-gray-600 text-center italic">Start a conversation!</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-lg max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-blue-100 self-end text-right'
                  : msg.role === 'assistant'
                  ? 'bg-green-100 self-start text-left'
                  : msg.role === 'analysis'
                  ? 'bg-yellow-100 self-start text-left'
                  : 'bg-gray-200 self-start text-left' // summary
              }`}
            >
              <p className="font-semibold text-sm capitalize">{msg.role}:</p>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <span className="text-xs text-gray-500 block mt-1">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex-shrink-0 flex items-center p-2 border-t mt-auto bg-white rounded-lg shadow-md">
        <textarea
          className="flex-grow p-2 border rounded-md resize-none mr-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder={`Ask about ${project.programming_language} code, or paste code for analysis...`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => handleSendMessage('generate_code')}
            className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm"
          >
            Generate Code
          </button>
          <button
            onClick={() => handleSendMessage('analyze_code')}
            className="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 text-sm"
          >
            Analyze Code
          </button>
          <button
            onClick={() => handleSendMessage('summarize_chat')}
            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm"
          >
            Summarize Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;