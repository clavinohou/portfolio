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
  // sortOrder is a datetime string (ISO-ish, YYYY-MM-DDTHH:mm). We store the
  // millisecond value and sort DESC so the most recently "pinned" project lands
  // at the top. To bump a project to the front, just edit sortOrder to "now" in
  // Decap — no renumbering required. Legacy numeric `order` (lower = first) is
  // still honored for any project that hasn't been migrated yet.
  const sortOrderRaw = (proj.sortOrder ?? '').toString().trim()
  const sortOrderMs = sortOrderRaw ? new Date(sortOrderRaw).getTime() : NaN
  const hasSortOrder = Number.isFinite(sortOrderMs)
  const legacyOrder = Number.isFinite(Number(proj.order)) ? Number(proj.order) : null
  return {
    id,
    title: proj.title ?? '',
    date: (proj.date ?? '').toString().trim(),
    // Short card blurb for the oscilloscope PROJECTS module. Plain text.
    summary: (proj.summary ?? '').toString().trim(),
    // Long-form markdown shown on the Build Log project page.
    description: proj.description ?? '',
    tags: flatList(proj.tags, 'tag'),
    link: proj.link?.trim?.() ? proj.link.trim() : null,
    // When false, hide this project from the Build Log site (/log and
    // /log/<id>) — it still appears on the portfolio. Defaults to true so
    // existing content without the field keeps showing everywhere.
    showInBuildLog: proj.showInBuildLog === false ? false : true,
    imageUrl: proj.imageUrl ?? '',
    images: projectImages(proj),
    // Two independent stack sizes so the narrow oscilloscope card and the
    // wider /log/<id> hero can show a different number of thumbnails.
    // buildLogStackSize falls back to stackSize if unset.
    stackSize: normalizeStackSize(proj.stackSize),
    buildLogStackSize: normalizeStackSize(proj.buildLogStackSize),
    _sortOrderMs: hasSortOrder ? sortOrderMs : null,
    _legacyOrder: legacyOrder,
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
      // 1. Projects with a sortOrder datetime sort ABOVE those without — newer
      //    (larger ms) comes first. This is the primary reorder knob now.
      const aHas = a._sortOrderMs !== null
      const bHas = b._sortOrderMs !== null
      if (aHas && bHas && a._sortOrderMs !== b._sortOrderMs) {
        return b._sortOrderMs - a._sortOrderMs
      }
      if (aHas !== bHas) return aHas ? -1 : 1
      // 2. Legacy numeric `order` (lower = first) — kept so pre-migration
      //    projects don't randomly jump when we roll this out.
      const aLegacy = a._legacyOrder ?? Number.POSITIVE_INFINITY
      const bLegacy = b._legacyOrder ?? Number.POSITIVE_INFINITY
      if (aLegacy !== bLegacy) return aLegacy - bLegacy
      // 3. Stable alphabetical fallback.
      return a.id.localeCompare(b.id)
    })
    // Hide internal sort keys from downstream consumers.
    .map(({ _sortOrderMs: _a, _legacyOrder: _b, ...rest }) => rest)
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
  const allProjects = buildProjects()
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
    // Full list used by the oscilloscope PROJECTS module — everything shows.
    projects: allProjects,
    // Subset shown on the Build Log site (/log and /log/<id>). Projects with
    // showInBuildLog=false are hidden here so legacy projects that predate
    // the build log can stay on the portfolio without polluting the notebook.
    buildLogProjects: allProjects.filter((proj) => proj.showInBuildLog !== false),
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
