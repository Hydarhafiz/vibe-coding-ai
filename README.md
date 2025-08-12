# Vibe Coder AI: An AI-Powered Code Generation and Analysis Tool
Vibe Coder AI is a full-stack web application designed to assist developers by providing an integrated environment for AI-driven code generation and analysis. Built with React, FastAPI, and utilizing local Large Language Models (LLMs) via Ollama, the platform offers a seamless experience for creating and refining code.

# Features
- Integrated Two-Panel Interface: A clean UI with a chat panel and a code editor side-by-side for a streamlined workflow .
- Intelligent Code Generation: Users can generate new code from scratch or modify existing code using natural language prompts.
- Real-time Code Analysis: The system provides instant, detailed feedback on generated code, including suggestions for improvements, bug fixes, and best practices.
- Dual-Model Architecture: The backend uses two specialized AI models for optimal performance: Qwen for generating and modifying code, and Llama for analyzing the code and providing a detailed summary .
- Persistent Chat History: All conversations are saved to a PostgreSQL database, allowing users to revisit past projects and continue conversations.
- Local and Private: By running open-source models with Ollama on a local machine (via WSL2), the application is cost-effective and ensures user data remains private.

# Technical Stack
- Frontend: React, Tailwind CSS
- Backend: Python, FastAPI
- Database: PostgreSQL
- AI Models: Qwen and Llama (run locally with Ollama on a WSL2 environment)

# How It Works
1. A user submits a prompt and any existing code from the frontend.
2. The backend's FastAPI server receives the request and constructs a comprehensive prompt.

3. This prompt is sent to the Qwen model via the Ollama API to generate or modify the code.

4. The generated code is then immediately sent to the Llama model for analysis.

5. The backend saves both the generated code and the analysis to the PostgreSQL database.

6. Finally, the system sends both the new code (to update the editor) and the analysis (to display in the chat) back to the frontend.
