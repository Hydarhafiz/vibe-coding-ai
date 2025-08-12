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
import ReactMarkdown from 'react-markdown';

// Helper function to extract the code block from a message
const extractCode = (messageContent: string): string => {
    const match = messageContent.match(/```(?:.|\n)*?```/g);
    if (match) {
        return match[0].replace(/```[a-z]*\n|```/g, '').trim();
    }
    return '';
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
    const [isThinking, setIsThinking] = useState(false);

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
            // Filter out assistant messages from chat history before setting the state
            const messagesToDisplay = fetchedMessages.filter(msg => msg.role !== 'assistant');
            setMessages(messagesToDisplay);

            const latestCodeMessage = [...fetchedMessages].reverse().find(msg => msg.role === 'assistant');
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

    // The main function to handle the unified AI interaction
    const handleGenerateCode = async () => {
        if (!project || isThinking) return;

        const userMessageContent = newMessage.trim();

        // Only proceed if there's a message or code to work with
        if (!userMessageContent && !code) {
            return;
        }

        setIsThinking(true);

        const userMessage: Message = {
            id: Date.now(), // Use a temporary unique ID
            project_id: parsedProjectId,
            role: 'user',
            content: userMessageContent,
            created_at: new Date().toISOString(),
        };

        // Optimistically add user's message to the chat
        setMessages((prev) => [...prev, userMessage]);
        setNewMessage(''); // Clear the input

        try {
            const chatRequest: ChatRequest = {
                project_id: parsedProjectId,
                user_id: import.meta.env.VITE_FIREBASE_APP_ID + "_demo_user",
                message_content: userMessageContent,
                programming_language: project.programming_language,
                chat_history: messages.map(msg => ({ content: msg.content, role: msg.role })),
                current_code: code,
            };

            const aiResponses = await chatService.chatWithAI(chatRequest);

            // Filter out the 'user' message that was just sent from the backend response
            const filteredResponses = aiResponses.filter(msg => msg.role !== 'user');

            // Find the analysis message
            const analysisMessage = filteredResponses.find(msg => msg.role === 'analysis');
            if (analysisMessage) {
                setMessages((prev) => [...prev, analysisMessage]);
            }

            // Find the code message to update the editor
            const newCodeMessage = filteredResponses.find(msg => msg.role === 'assistant');
            if (newCodeMessage) {
                setCode(extractCode(newCodeMessage.content));
            }

        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to get AI response. Please try again.');
            // On failure, remove the optimistic user message
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
            case 'csharp': return 'csharp';
            case 'go': return 'golang'; // Ace editor mode for Go is 'golang'
            default: return 'text';
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-xl text-gray-700">Loading project...</div>;
    if (error) return <div className="flex items-center justify-center h-screen bg-gray-50 text-xl text-red-500">Error: {error}</div>;
    if (!project) return <div className="flex items-center justify-center h-screen bg-gray-50 text-xl text-gray-700">Project not found.</div>;

    const editorMode = getEditorMode(project.programming_language);

    return (
        <div className="flex h-screen bg-gray-50 font-sans"> {/* Added bg-gray-50 and font-sans */}
            {/* Left Panel: Chat Interface */}
            <div className="flex-1 flex flex-col p-6 border-r border-gray-200 bg-white shadow-lg rounded-lg m-4"> {/* Enhanced styling */}
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-4 border-gray-200"> {/* Larger, bolder title */}
                    {project.project_name} ({project.programming_language})
                </h1>

                {/* Chat History */}
                <div className="flex-grow overflow-y-auto pr-2 mb-6 p-4 border border-gray-200 rounded-xl bg-gray-100 shadow-inner custom-scrollbar">
                    {messages.length === 0 ? (
                        <p className="text-gray-500 text-center italic py-10">Start a conversation to generate or analyze code! ✨</p>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                // Change the className here
                                className={`flex my-2 break-words ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                <div
                                    className={`p-3 rounded-lg shadow-md max-w-[85%] ${msg.role === 'user'
                                            ? 'bg-blue-500 text-white rounded-br-none'
                                            : 'bg-yellow-100 text-yellow-800 rounded-bl-none'
                                        }`}
                                >
                                    <p className="font-semibold text-xs capitalize opacity-80 mb-1">
                                        {msg.role === 'user' ? 'You' : msg.role === 'analysis' ? 'AI Analysis' : msg.role}
                                    </p>
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                    <span className="text-xs opacity-70 block mt-2">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input and Action Button */}
                <div className="flex-shrink-0 flex items-center p-4 border border-gray-200 rounded-xl bg-white shadow-md"> {/* Integrated shadow */}
                    <textarea
                        className="flex-grow p-3 border border-gray-300 rounded-lg resize-none mr-3 focus:ring-blue-500 focus:border-blue-500 text-gray-800 text-sm focus:outline-none transition duration-150 ease-in-out"
                        rows={3}
                        placeholder="Describe the code you want, or ask for refinements..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={isThinking}
                    />
                    <button
                        onClick={handleGenerateCode}
                        className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-800 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition duration-200 ease-in-out text-base font-semibold disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={isThinking}
                    >
                        {isThinking ? 'Thinking...' : 'Generate Code'}
                    </button>
                </div>
            </div>

            {/* Right Panel: Code Editor */}
            <div className="flex-1 p-6 flex flex-col bg-white shadow-lg rounded-lg m-4"> {/* Enhanced styling */}
                <h2 className="text-3xl font-extrabold text-gray-800 mb-6 border-b pb-4 border-gray-200">Code Editor</h2>
                <div className="flex-grow border border-gray-200 rounded-xl overflow-hidden shadow-inner"> {/* Matching border and shadow */}
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
                        style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }} // Apply border-radius via style prop for AceEditor
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailPage;