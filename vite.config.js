import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages project site lives under /FormularioAudit/
  base: command === 'build' ? '/FormularioAudit/' : '/',
  plugins: [react()],
}))
