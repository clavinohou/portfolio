import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { startPostHog } from './lib/posthog.js'

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

// Start analytics after restoring a deep link so GA4 records the actual page.
const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim()
if (
  import.meta.env.PROD &&
  window.location.hostname === 'calvinhou.com' &&
  /^G-[A-Z0-9]+$/.test(measurementId ?? '')
) {
  window.dataLayer = window.dataLayer || []
  function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', measurementId, { allow_google_signals: false, allow_ad_personalization_signals: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startPostHog()
