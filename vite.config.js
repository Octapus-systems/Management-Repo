import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// Management Command Center — separate web app talking to the same Encore API.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: Number(process.env.PORT) || 5180,
    proxy: { '/api': process.env.VITE_API_URL || `http://localhost:${process.env.API_PORT || 4000}` },
  },
});
