import raw from './cms/site.json'

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
    projects: (rawData.projects || []).map((proj) => ({
      id: proj.id ?? '',
      title: proj.title ?? '',
      date: (proj.date ?? '').trim(),
      description: proj.description ?? '',
      tags: flatList(proj.tags, 'tag'),
      link: proj.link?.trim() ? proj.link.trim() : null,
      imageUrl: proj.imageUrl ?? '',
      images: projectImages(proj),
      stackSize: normalizeStackSize(proj.stackSize),
    })),
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

export const siteContent = normalize(raw)
