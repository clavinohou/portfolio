const VIEWS = new Set(['3D', 'PCB', 'SCH'])

export function archiveUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const source = value.trim()
  if (source.startsWith('/uploads/') && !source.includes('..') && /\.(zip|rar|7z)$/i.test(source)) return source
  try {
    const url = new URL(source)
    if (url.protocol === 'https:' && !url.username && !url.password && /\.(zip|rar|7z)$/i.test(url.pathname)) return url.href
  } catch { /* Missing or invalid optional source. */ }
  return null
}

export function resolvePcbViewer(value) {
  if (!value || typeof value !== 'object') return null
  const defaultView = VIEWS.has(value.defaultView) ? value.defaultView : '3D'
  try {
    const url = new URL(value.embedUrl)
    if (url.protocol === 'https:' && url.hostname === 'personal-viewer.365.altium.com'
      && !url.port && !url.username && !url.password && url.pathname === '/client/index.html'
      && /^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(url.searchParams.get('source'))) {
      url.searchParams.set('feature', 'embed')
      url.searchParams.set('activeView', defaultView)
      return { src: url.href, externalUrl: url.href }
    }
  } catch { /* Try the public archive instead. */ }
  const archive = archiveUrl(value.archiveUrl)
  if (!archive) return null
  const query = new URLSearchParams({ source: archive, view: defaultView })
  const src = `/viewers/altium.html?${query}`
  return { src, externalUrl: src }
}
