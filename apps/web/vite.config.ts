import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@indigo/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@indigo/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@indigo/ai': path.resolve(__dirname, '../../packages/ai/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
})
