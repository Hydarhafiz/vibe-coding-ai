// frontend/src/pages/Projects/index.tsx
import React, { useState, useEffect } from 'react';
import { projectService } from '../../services/api';
import { Link } from 'react-router-dom'; // Will need React Router later
import type { ProjectCreate } from '../../interfaces/ProjectCreate';
import type { Project } from '../../interfaces/Project';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLang, setNewProjectLang] = useState('python');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectLang.trim()) {
      alert('Project name and language cannot be empty.');
      return;
    }
    const projectData: ProjectCreate = {
      project_name: newProjectName,
      programming_language: newProjectLang,
    };
    try {
      const createdProject = await projectService.createProject(projectData);
      setProjects([...projects, createdProject]);
      setNewProjectName('');
      setNewProjectLang('python');
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    }
  };

  if (loading) return <div className="p-4">Loading projects...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Projects</h1>

      <form onSubmit={handleCreateProject} className="mb-8 p-4 border rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-3">Create New Project</h2>
        <div className="mb-3">
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">Project Name</label>
          <input
            type="text"
            id="projectName"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="programmingLanguage" className="block text-sm font-medium text-gray-700">Programming Language</label>
          <select
            id="programmingLanguage"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            value={newProjectLang}
            onChange={(e) => setNewProjectLang(e.target.value)}
            required
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
            <option value="go">Go</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create Project
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-3">Existing Projects</h2>
      {projects.length === 0 ? (
        <p className="text-gray-600">No projects yet. Create one above!</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id} className="p-3 border rounded-md shadow-sm bg-white hover:bg-gray-50 transition duration-150 ease-in-out">
              <Link to={`/project/${project.id}`} className="block">
                <h3 className="text-lg font-bold text-blue-800">{project.project_name}</h3>
                <p className="text-sm text-gray-600">Language: {project.programming_language}</p>
                <p className="text-xs text-gray-500">Created: {new Date(project.created_at).toLocaleDateString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectsPage;