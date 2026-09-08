import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Si se compila en Cloudflare Pages se sirve desde '/', si es GitHub Pages desde '/FormularioAudit/'
  base: process.env.CF_PAGES ? '/' : (command === 'build' ? '/FormularioAudit/' : '/'),
  plugins: [react()],
}))
