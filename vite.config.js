import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Set VITE_HMR=off when serving through a proxy/preview host that cannot reach
// Vite's websocket port — the app then simply refreshes instead of hot-patching.
const hmr = process.env.VITE_HMR === 'off' ? false : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr,
    proxy: {
      // The browser only ever talks to this origin; Vite forwards the socket to
      // the arena server so online PvP works from any host or preview URL.
      '/ws': {
        target: process.env.ARENA_WS || 'ws://127.0.0.1:8787',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
