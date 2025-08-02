// frontend/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ProjectsPage from './pages/Projects';
import ProjectDetailPage from './pages/ProjectDetail';
import './index.css'; // Import global styles (e.g., Tailwind CSS)

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 font-sans">
        <header className="bg-gray-800 text-white p-4 shadow-md">
          <nav className="flex justify-between items-center max-w-7xl mx-auto">
            <Link to="/" className="text-2xl font-bold text-indigo-300 hover:text-indigo-200 transition duration-300">
              Vibe Coder AI
            </Link>
            <div>
              <Link to="/" className="text-white hover:text-gray-300 mx-2">
                Projects
              </Link>
              {/* Add more nav links here if needed */}
            </div>
          </nav>
        </header>

        <main className="py-6">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/project/:projectId" element={<ProjectDetailPage />} />
            {/* Add more routes here as your app grows */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;