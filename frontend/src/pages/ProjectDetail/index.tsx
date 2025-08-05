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

// We need a helper to check if a message contains code
const isCodeMessage = (message: Message) => {
    // A simple heuristic for now: check for ``` in the message content
    return message.content.includes('```');
};

const ProjectDetailPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState<string>(''); // State for the code editor content
    const chatEndRef = useRef<HTMLDivElement>(null); // To auto-scroll chat

    const parsedProjectId = projectId ? parseInt(projectId) : NaN;

    // Scroll to the bottom of the chat window on message change
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

            // Find the latest code snippet in the fetched messages and set the code state
            const latestCodeMessage = fetchedMessages.reverse().find(msg => isCodeMessage(msg));
            if (latestCodeMessage) {
                const codeContent = latestCodeMessage.content.match(/```(?:.|\n)*?```/g)?.[0] || '';
                setCode(codeContent.replace(/```[a-z]*\n|```/g, '').trim());
            }

        } catch (err) {
            console.error('Error fetching project details:', err);
            setError('Failed to load project details or messages.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (action: 'generate_code' | 'analyze_code' | 'summarize_chat') => {
        // If a new message is not provided, and the action is not a summary, don't send
        if (!newMessage.trim() && action !== 'summarize_chat' || !project) return;
        
        // Use the code from the editor if the user wants to analyze or generate based on it
        const messageContentToSend = action === 'analyze_code' ? code : newMessage;

        const userMessage: Message = {
            id: Date.now(),
            project_id: parsedProjectId,
            role: 'user',
            content: newMessage, // The content of the chat message is the user's input
            created_at: new Date().toISOString(),
        };
        
        setMessages((prev) => [...prev, userMessage]);
        setNewMessage(''); // Clear chat input

        try {
            const chatRequest = {
                project_id: parsedProjectId,
                user_id: import.meta.env.VITE_FIREBASE_APP_ID + "_demo_user",
                message_content: messageContentToSend, // Use the code content for analysis
                action: action,
                programming_language: project.programming_language,
                chat_history: messages.map(msg => ({ content: msg.content, role: msg.role })),
            };
            const aiResponse = await chatService.chatWithAI(chatRequest);
            setMessages((prev) => [...prev, aiResponse]);

            // If the AI response contains code, update the editor
            if (isCodeMessage(aiResponse)) {
                const codeContent = aiResponse.content.match(/```(?:.|\n)*?```/g)?.[0] || '';
                const extractedCode = codeContent.replace(/```[a-z]*\n|```/g, '').trim();
                setCode(extractedCode);
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to get AI response. Please try again.');
            setMessages((prev) => prev.filter(msg => msg.id !== userMessage.id));
        }
    };
    
    // Determine the Ace Editor mode based on the project's programming language
    const getEditorMode = (lang: string) => {
        switch (lang.toLowerCase()) {
            case 'javascript':
                return 'javascript';
            case 'python':
                return 'python';
            case 'java':
                return 'java';
            case 'typescript':
                return 'typescript';
            // Add more cases for other languages
            default:
                return 'text';
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