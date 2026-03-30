/** Resolve root-relative or relative paths for Vite `base` (e.g. GitHub Pages project sites). */
export function publicUrl(path) {
  if (!path || typeof path !== 'string') return ''
  const t = path.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const p = t.startsWith('/') ? t : `/${t}`
  return `${base}${p}`
}
