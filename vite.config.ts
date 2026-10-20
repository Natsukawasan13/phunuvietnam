import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:4173'
const apiProxy = {
  target: apiTarget,
  changeOrigin: true,
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': apiProxy } },
  preview: { proxy: { '/api': apiProxy } },
})
