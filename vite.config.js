import { spawnSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function projectLastUpdate() {
  const { stdout } = spawnSync('git', [
    'log', '-1', '--format=%cI', '--',
    'src/content/cms/projects',
    'src/content/cms/blog',
    'src/components/BlogHome.*',
    'src/components/ProjectPage.*',
    'src/components/ProjectGallery.*',
    'src/components/ImageCarousel.*',
    'src/components/PcbViewer.*',
  ], { encoding: 'utf8' })
  return stdout?.trim() || ''
}

/** Vite’s SPA fallback serves `/index.html` for `/admin/`; rewrite so Decap loads from `public/admin/index.html`. */
function decapAdminRoute() {
  const rewrite = (req, _res, next) => {
    const raw = req.url ?? ''
    const pathOnly = raw.split('?')[0]
    if (pathOnly === '/admin' || pathOnly === '/admin/') {
      const q = raw.includes('?') ? `?${raw.split('?').slice(1).join('?')}` : ''
      req.url = `/admin/index.html${q}`
    }
    next()
  }
  return {
    name: 'decap-admin-route',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [decapAdminRoute(), react()],
  define: { __PROJECT_LAST_UPDATE__: JSON.stringify(projectLastUpdate()) },
  // Let Vite resolve the spreadsheet viewer’s worker next to the package.
  optimizeDeps: { exclude: ['@extend-ai/react-xlsx'], include: ['react', 'react-dom', 'react/jsx-runtime'] },
  base: '/', // Change to '/your-repo-name/' if deploying to GitHub Pages with a repo name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})


