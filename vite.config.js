import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Change to '/your-repo-name/' if deploying to GitHub Pages with a repo name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})


