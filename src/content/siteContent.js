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
