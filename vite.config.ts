import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    root: path.resolve(process.cwd(), 'frontend'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@bklitui/ui/charts', replacement: path.resolve(process.cwd(), 'frontend/src/bklitui/charts.tsx') },
        { find: '@bklitui/ui', replacement: path.resolve(process.cwd(), 'frontend/src/bklitui') },
        { find: '@', replacement: path.resolve(process.cwd(), 'frontend/src') },
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(
        process.env.VITE_BACKEND_URL || 'https://expensetracker2-0-jl02.onrender.com'
      ),
    },
    build: {
      outDir: path.resolve(process.cwd(), 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(process.cwd(), 'frontend/index.html'),
          login: path.resolve(process.cwd(), 'frontend/login.html'),
          signup: path.resolve(process.cwd(), 'frontend/signup.html'),
        },
      },
    },
  };
});
