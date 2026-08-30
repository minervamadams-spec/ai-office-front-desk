import { defineConfig } from 'vite';

// better-sqlite3 is a native module (a real .node binary, not JS) — it can't be bundled, so it
// stays external here and forge.config.ts's afterCopy hook copies the real node_modules folder
// into the packaged app instead.
export default defineConfig({ build: { rollupOptions: { external: ['electron', 'better-sqlite3'] } } });
