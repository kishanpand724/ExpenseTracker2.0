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
    build: {
      outDir: path.resolve(process.cwd(), 'dist'),
      emptyOutDir: true,
    },
  };
});
