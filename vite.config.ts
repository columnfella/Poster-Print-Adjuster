import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {aiUpscaleHandler} from './server/aiUpscale.ts';

/** Serves /api/ai-upscale (free Hugging Face AI upscaler proxy) in dev and preview. */
function aiUpscaleApi(): Plugin {
  // Must not return anything: Vite treats a returned function as a post-middleware hook.
  const mount = (server: {middlewares: {use: (path: string, fn: any) => unknown}}): void => {
    server.middlewares.use('/api/ai-upscale', aiUpscaleHandler);
  };
  return {
    name: 'ai-upscale-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aiUpscaleApi()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
