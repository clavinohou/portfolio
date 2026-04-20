import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

// SPA fallback: if /404.html bounced us here with a stashed deep-link, restore
// the original URL before React mounts so the router sees the right path.
if (typeof window !== 'undefined') {
  try {
    const stashed = sessionStorage.getItem('__spa_redirect__')
    if (stashed) {
      sessionStorage.removeItem('__spa_redirect__')
      if (stashed !== window.location.pathname + window.location.search + window.location.hash) {
        window.history.replaceState(null, '', stashed)
      }
    }
  } catch {
    // sessionStorage might be unavailable (private mode, etc.) — safe to ignore.
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
