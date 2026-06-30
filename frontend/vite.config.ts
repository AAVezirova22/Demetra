import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.dev'],
    hmr: process.env.DISABLE_VITE_HMR === 'true' ? false : undefined,
    proxy: {
      '/api': 'http://api:3000',
      '/socket.io': {
        target: 'http://api:3000',
        ws: true,
      },
    },
  },
})
