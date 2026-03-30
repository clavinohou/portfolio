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
      description: proj.description ?? '',
      tags: flatList(proj.tags, 'tag'),
      link: proj.link?.trim() ? proj.link.trim() : null,
      imageUrl: proj.imageUrl ?? '',
      images: projectImages(proj),
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
      highlights: flatList(rawData.resume?.highlights, 'highlight'),
    },
  }
}

export const siteContent = normalize(raw)
