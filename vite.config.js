import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'littlejs-full-reload',
    handleHotUpdate({ server, file }) {
      if (!file.replaceAll('\\', '/').includes('/src/')) return;
      // The engine owns canvases, input listeners and its animation loop.
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  }],
  server: { watch: { ignored: ['**/artifacts/**', '**/.npm-cache/**'] } },
});
