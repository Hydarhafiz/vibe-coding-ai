// frontend/src/pages/ProjectDetail/index.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom'; // For getting project ID from URL
import { projectService, chatService } from '../../services/api';
import type { Project } from '../../interfaces/Project';
import type { Message } from '../../interfaces/Message';

// Import Ace Editor and its dependencies
import AceEditor from 'react-ace';
import "ace-builds/src-noconflict/mode-javascript"; // Example mode
import "ace-builds/src-noconflict/theme-monokai";   // Example theme
import "ace-builds/src-noconflict/ext-language_tools"; // Autocompletion, etc.
import type { ChatRequest } from '../../interfaces/ChatRequest';

// Helper function to extract the code block from a message
const extractCode = (messageContent: string): string => {
    const match = messageContent.match(/```(?:.|\n)*?```/g);
    if (match) {
        // We take the first match and clean up the markdown backticks
        return match[0].replace(/```[a-z]*\n|```/g, '').trim();
    }
    return '';
};

const isCodeMessage = (message: Message) => {
    return message.role === 'assistant' && message.content.includes('```');
};

const ProjectDetailPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState<string>('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [isThinking, setIsThinking] = useState(false); // New state to disable buttons during AI processing

    const parsedProjectId = projectId ? parseInt(projectId) : NaN;

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
            const fetchedProject = await projectService.getProject(parsedProjectId);
            if (!fetchedProject) {
                throw new Error('Project not found');
            }
            setProject(fetchedProject);

            const fetchedMessages = await projectService.getMessagesForProject(parsedProjectId);
            setMessages(fetchedMessages);

            const latestCodeMessage = [...fetchedMessages].reverse().find(msg => isCodeMessage(msg));
            if (latestCodeMessage) {
                setCode(extractCode(latestCodeMessage.content));
            }
        } catch (err) {
            console.error('Error fetching project details:', err);
            setError('Failed to load project details or messages.');
        } finally {
            setLoading(false);
        }
    };
    
    // The main function to handle all AI interactions
    const handleAction = async (action: 'generate_and_analyze' | 'analyze_code_only' | 'summarize_chat') => {
        if (!project) return;
        setIsThinking(true); // Disable buttons

        const userMessage: Message = {
            id: Date.now(),
            project_id: parsedProjectId,
            role: 'user',
            content: newMessage,
            created_at: new Date().toISOString(),
        };

        // If the action is for analysis or a follow-up, send the code editor content as well
        const messageContentToSend = (action === 'analyze_code_only' || newMessage.trim() === '') ? code : newMessage;
        const chatHistoryForRequest = messages.map(msg => ({ content: msg.content, role: msg.role }));

        // Optimistically add user's message to the chat
        setMessages((prev) => [...prev, userMessage]);
        setNewMessage(''); // Clear the input

        try {
            const chatRequest: ChatRequest = {
                project_id: parsedProjectId,
                user_id: import.meta.env.VITE_FIREBASE_APP_ID + "_demo_user",
                message_content: messageContentToSend,
                action: action,
                programming_language: project.programming_language,
                chat_history: chatHistoryForRequest,
                current_code: code,
            };

            const aiResponses = await chatService.chatWithAI(chatRequest);
            setMessages((prev) => [...prev, ...aiResponses]);

            // Update code editor with the first message that contains a code block
            const newCodeMessage = aiResponses.find(msg => isCodeMessage(msg));
            if (newCodeMessage) {
                setCode(extractCode(newCodeMessage.content));
            }

        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to get AI response. Please try again.');
            // Remove optimistic message on failure
            setMessages((prev) => prev.filter(msg => msg.id !== userMessage.id));
        } finally {
            setIsThinking(false);
        }
    };

    const getEditorMode = (lang: string) => {
        switch (lang.toLowerCase()) {
            case 'javascript': return 'javascript';
            case 'python': return 'python';
            case 'java': return 'java';
            case 'typescript': return 'typescript';
            default: return 'text';
        }
    };

    if (loading) return <div className="p-4">Loading project...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
    if (!project) return <div className="p-4">Project not found.</div>;

    const editorMode = getEditorMode(project.programming_language);

    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Left Panel: Chat Interface */}
            <div className="flex-1 flex flex-col p-4 border-r">
                <h1 className="text-2xl font-bold mb-4">{project.project_name} ({project.programming_language})</h1>
                
                {/* Chat History */}
                <div className="flex-grow overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50 flex flex-col space-y-3">
                    {messages.length === 0 ? (
                        <p className="text-gray-600 text-center italic">Start a conversation!</p>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`p-2 rounded-lg max-w-[80%] ${
                                    msg.role === 'user' ? 'bg-blue-100 self-end text-right' : 
                                    msg.role === 'assistant' ? 'bg-green-100 self-start text-left' :
                                    msg.role === 'analysis' ? 'bg-yellow-100 self-start text-left' :
                                    'bg-gray-200 self-start text-left'
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
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input and Action Buttons */}
                <div className="flex-shrink-0 flex items-center p-2 border-t mt-auto bg-white rounded-lg shadow-md">
                    <textarea
                        className="flex-grow p-2 border rounded-md resize-none mr-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder={`Ask about ${project.programming_language} code, or paste code for analysis...`}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={isThinking}
                    />
                    <div className="flex flex-col space-y-2">
                        {/* Unified button for primary workflow */}
                        <button
                            onClick={() => handleAction('generate_and_analyze')}
                            className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 text-sm disabled:bg-gray-400"
                            disabled={isThinking}
                        >
                            Generate & Analyze
                        </button>
                        {/* Separate button for secondary workflow */}
                        <button
                            onClick={() => handleAction('analyze_code_only')}
                            className="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 text-sm disabled:bg-gray-400"
                            disabled={isThinking}
                        >
                            Analyze Current Code
                        </button>
                         {/* Summarize is a distinct, one-off action */}
                        <button
                            onClick={() => handleAction('summarize_chat')}
                            className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm disabled:bg-gray-400"
                            disabled={isThinking}
                        >
                            Summarize Chat
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Code Editor */}
            <div className="flex-1 p-4 flex flex-col">
                <h2 className="text-xl font-bold mb-4">Code Editor</h2>
                <div className="flex-grow border rounded-lg overflow-hidden">
                    <AceEditor
                        mode={editorMode}
                        theme="monokai"
                        name="ace-editor"
                        fontSize={14}
                        showPrintMargin={false}
                        showGutter={true}
                        highlightActiveLine={true}
                        value={code}
                        onChange={(newCode) => setCode(newCode)}
                        setOptions={{
                            enableBasicAutocompletion: true,
                            enableLiveAutocompletion: true,
                            showLineNumbers: true,
                            tabSize: 2,
                        }}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailPage;