import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@bklitui/ui/charts', replacement: path.resolve(__dirname, 'src/bklitui/charts.tsx') },
        { find: '@bklitui/ui', replacement: path.resolve(__dirname, 'src/bklitui') },
        { find: '@', replacement: path.resolve(__dirname, 'src') },
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: path.resolve(__dirname, '../dist'),
      emptyOutDir: true,
    },
  };
});
