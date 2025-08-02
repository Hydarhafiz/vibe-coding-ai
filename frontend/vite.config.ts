// frontend/vite.config.ts
import { defineConfig, loadEnv } from 'vite'; // Import loadEnv
import react from '@vitejs/plugin-react';

// No need for dotenv directly if using Vite's loadEnv
// dotenv.config({ path: '../frontend/.env' }); // REMOVE or correct this line

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => { // Add 'mode' argument
  // Load environment variables based on the current mode (e.g., 'development', 'production')
  // This correctly loads .env, .env.development, etc.
  const env = loadEnv(mode, process.cwd(), ''); // process.cwd() is frontend dir, '' loads all VITE_ prefixed envs

  // Get the backend URL from environment variables, defaulting to localhost
  // Use env.VITE_BACKEND_URL instead of process.env
  const BACKEND_URL = env.VITE_BACKEND_URL || 'http://localhost:8000';
  const FRONTEND_PORT = parseInt(env.VITE_FRONTEND_PORT || '5173');

  console.log(`Vite config: Proxying API requests to: ${BACKEND_URL}`);
  console.log(`Vite config: Frontend server running on port: ${FRONTEND_PORT}`);

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy all requests starting with /api to your backend
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true, // Needed for virtual hosted sites
          // Rewrite the path to remove /api if your backend endpoints don't start with it
          // (Your backend endpoints are like /projects, /chat, not /api/projects)
          rewrite: (path) => path.replace(/^\/api/, ''),
          // Add console.log to debug proxy hits
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`[Vite Proxy] Proxying ${req.method} ${req.url} to ${options.target}${proxyReq.path}`);
            });
            proxy.on('error', (err, req, res) => {
              console.error(`[Vite Proxy Error] ${req.url}:`, err);
            });
          },
        },
      },
      port: FRONTEND_PORT, // Use port from env or default
    },
  };
});