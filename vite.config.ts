import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Marca de agua de versión (ver src/components/shared/BuildInfoBadge.tsx):
// se congela en build time, no en runtime, para que refleje exactamente qué
// commit/momento generó el bundle que el navegador está sirviendo — así se
// puede confirmar si Cloudflare ya desplegó el build esperado.
function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'sin-git'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __APP_COMMIT__: JSON.stringify(getCommitHash()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
