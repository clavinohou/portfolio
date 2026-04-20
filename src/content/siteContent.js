import rawSite from './cms/site.json'

// —— Folder collections ————————————————————————————————————
// Each project / blog entry is its own JSON file, authored through Decap CMS
// as a folder collection. Vite picks them up at build time via import.meta.glob
// so new files just need to be dropped in — no loader changes required.
const projectModules = import.meta.glob('./cms/projects/*.json', { eager: true, import: 'default' })
const blogModules = import.meta.glob('./cms/blog/*.json', { eager: true, import: 'default' })

// —— Helpers ——————————————————————————————————————————————
function flatList(arr, key) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((x) => {
      if (typeof x === 'string') return x
      if (x && typeof x === 'object' && key in x) return x[key]
      return ''
    })
    .filter(Boolean)
}

/** Cover image first, then extra gallery URLs (deduped). */
function projectImages(proj) {
  const primary = (proj.imageUrl ?? '').trim()
  const extra = flatList(proj.gallery, 'src')
  const out = []
  if (primary) out.push(primary)
  for (const u of extra) {
    if (u && !out.includes(u)) out.push(u)
  }
  return out
}

function normalizeStackSize(val) {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val
  const n = Number(val)
  if (Number.isFinite(n) && n > 0) return n
  return null
}

/** Derive a stable id from either the `id` field or the filename. */
function idFromPath(path) {
  const file = path.split('/').pop() || ''
  return file.replace(/\.json$/i, '').trim()
}

function normalizeProject(proj, path) {
  const id = (proj.id ?? '').toString().trim() || idFromPath(path)
  return {
    id,
    title: proj.title ?? '',
    date: (proj.date ?? '').toString().trim(),
    description: proj.description ?? '',
    tags: flatList(proj.tags, 'tag'),
    link: proj.link?.trim?.() ? proj.link.trim() : null,
    imageUrl: proj.imageUrl ?? '',
    images: projectImages(proj),
    stackSize: normalizeStackSize(proj.stackSize),
    // numeric order field controls display order on the site (1, 2, 3…).
    // Unset entries sort to the end but remain stable by id.
    order: Number.isFinite(Number(proj.order)) ? Number(proj.order) : Number.POSITIVE_INFINITY,
  }
}

function normalizeBlogEntry(entry, path) {
  const id = (entry.id ?? '').toString().trim() || idFromPath(path)
  const dateRaw = (entry.date ?? '').toString().trim()
  const dateObj = dateRaw ? new Date(dateRaw) : null
  const hasValidDate = dateObj && !Number.isNaN(dateObj.getTime())
  return {
    id,
    title: (entry.title ?? '').toString(),
    date: dateRaw,
    dateIso: hasValidDate ? dateObj.toISOString() : '',
    dateMs: hasValidDate ? dateObj.getTime() : 0,
    project: (entry.project ?? '').toString().trim() || null,
    tags: flatList(entry.tags, 'tag'),
    summary: (entry.summary ?? '').toString(),
    body: (entry.body ?? '').toString(),
    images: flatList(entry.gallery, 'src'),
    stackSize: normalizeStackSize(entry.stackSize),
  }
}

// —— Build the final, normalized site content ——————————————
function buildProjects() {
  const entries = Object.entries(projectModules).map(([path, mod]) =>
    normalizeProject(mod ?? {}, path),
  )
  return entries
    .filter((p) => p.id && p.title)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.id.localeCompare(b.id)
    })
    .map(({ order: _order, ...rest }) => rest) // hide the internal order key from consumers
}

function buildBlog() {
  const entries = Object.entries(blogModules).map(([path, mod]) =>
    normalizeBlogEntry(mod ?? {}, path),
  )
  return entries
    .filter((e) => e.id && (e.title || e.body))
    .sort((a, b) => b.dateMs - a.dateMs)
}

function normalize(rawData) {
  const p = rawData.profile || {}
  return {
    profile: {
      name: p.name ?? '',
      title: p.title ?? '',
      scopeBrief: p.scopeBrief ?? '',
      school: p.school ?? '',
      location: p.location ?? '',
      year: p.year ?? '',
      interests: flatList(p.interests, 'interest'),
      about: flatList(p.about, 'paragraph'),
    },
    projects: buildProjects(),
    blog: buildBlog(),
    experience: (rawData.experience || []).map((ex) => ({
      id: ex.id ?? '',
      type: ex.type ?? '',
      title: ex.title ?? '',
      company: ex.company ?? '',
      location: ex.location ?? '',
      date: ex.date ?? '',
      description: ex.description ?? '',
      tags: flatList(ex.tags, 'tag'),
      images: flatList(ex.gallery, 'src'),
      stackSize: normalizeStackSize(ex.stackSize),
    })),
    links: {
      email: rawData.links?.email ?? '',
      github: rawData.links?.github ?? '',
      linkedin: rawData.links?.linkedin ?? '',
      instagram: rawData.links?.instagram ?? '',
    },
    resume: {
      downloadLabel: rawData.resume?.downloadLabel ?? 'Download Resume',
      downloadUrl: rawData.resume?.downloadUrl ?? '/resume/CalvinHouResume.pdf',
      lastUpdated: String(rawData.resume?.lastUpdated ?? '').trim(),
      highlights: flatList(rawData.resume?.highlights, 'highlight'),
    },
  }
}

export const siteContent = normalize(rawSite)
