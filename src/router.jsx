import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Minimal zero-dep client-side router.
 *
 * Exposes:
 *  - RouterProvider: wraps the app; keeps the current pathname in state.
 *  - useRouter(): { path, navigate }
 *  - Link: drop-in <a> replacement that does client-side navigation on left-click
 *    (cmd/ctrl/middle-click still open a new tab via the normal <a> fallback).
 *
 * Why roll our own: this project only has two top-level routes (/ and /log/*),
 * so pulling in react-router for this is overkill.
 */

const RouterContext = createContext(null)

function getCurrentPath() {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname + window.location.search + window.location.hash
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(getCurrentPath)

  useEffect(() => {
    const onPop = () => setPath(getCurrentPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, opts = {}) => {
    if (typeof window === 'undefined') return
    const current = getCurrentPath()
    if (to === current && !opts.force) return
    if (opts.replace) {
      window.history.replaceState(null, '', to)
    } else {
      window.history.pushState(null, '', to)
    }
    setPath(to)
    if (opts.scrollToTop !== false) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [])

  const value = useMemo(() => ({ path, navigate }), [path, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

/** Strip search/hash and trailing slash so the switcher can just string-compare. */
export function normalizePath(path) {
  if (!path) return '/'
  const clean = path.split('?')[0].split('#')[0]
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean || '/'
}

export function Link({ to, onClick, children, replace, scrollToTop, ...rest }) {
  const { navigate } = useRouter()

  const handleClick = (e) => {
    if (onClick) onClick(e)
    if (e.defaultPrevented) return
    // Let the browser handle: non-primary clicks, modified clicks, or target="_blank"
    if (e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(to, { replace, scrollToTop })
  }

  return (
    <a {...rest} href={to} onClick={handleClick}>
      {children}
    </a>
  )
}
