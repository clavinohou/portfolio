import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { siteContent } from '../content/siteContent'
import { ImageCarousel } from './ImageCarousel'
import { MarkdownBlock } from './MarkdownBlock'
import { Link, useRouter } from '../router'
import { Nav } from './BlogHome'
import './BlogHome.css'
import './ProjectPage.css'

const TRACE_COLORS = [
  '#ff6b35',
  '#f4c542',
  '#4ea8ff',
  '#22c55e',
  '#5eead4',
  '#ef4444',
  '#a78bfa',
  '#f472b6',
]

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatEntryDate(iso, raw) {
  if (!iso) return { date: raw || '—', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: raw || '—', time: '' }
  return {
    date: DATE_FORMATTER.format(d).toUpperCase(),
    time: TIME_FORMATTER.format(d),
  }
}

function pad(n, width = 3) {
  return n.toString().padStart(width, '0')
}

export default function ProjectPage({ projectId }) {
  // Portfolio-only projects (showInBuildLog=false) are intentionally absent
  // from buildLogProjects, so visiting /log/<their-id> hits the existing
  // "project not found" UI below.
  const { buildLogProjects: projects, blog } = siteContent
  const { navigate } = useRouter()

  const { project, projectIndex } = useMemo(() => {
    const idx = projects.findIndex((p) => p.id === projectId)
    return { project: idx >= 0 ? projects[idx] : null, projectIndex: idx }
  }, [projects, projectId])

  const entries = useMemo(
    () => blog.filter((entry) => entry.project === projectId),
    [blog, projectId],
  )

  const { prevProject, nextProject } = useMemo(() => {
    if (projectIndex < 0) return { prevProject: null, nextProject: null }
    return {
      prevProject: projectIndex > 0 ? projects[projectIndex - 1] : null,
      nextProject: projectIndex < projects.length - 1 ? projects[projectIndex + 1] : null,
    }
  }, [projects, projectIndex])

  useEffect(() => {
    document.documentElement.classList.add('bloglog-open')
    return () => {
      document.documentElement.classList.remove('bloglog-open')
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') navigate('/log')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const accent = project
    ? TRACE_COLORS[Math.max(0, projectIndex) % TRACE_COLORS.length]
    : '#ff6b35'
  const channelLabel = projectIndex >= 0 ? `CH${projectIndex + 1}` : 'CH?'

  if (!project) {
    return (
      <div className="projectlog" style={{ '--pp-accent': accent }}>
        <Nav variant="project" />
        <main className="projectlog-page projectlog-missing">
          <p className="mono">PROJECT NOT FOUND · {projectId}</p>
          <Link to="/log" className="projectlog-cta projectlog-cta--ghost mono">
            ← BACK TO ALL PROJECTS
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="projectlog" style={{ '--pp-accent': accent }}>
      <Nav variant="project" />

      <main className="projectlog-page">
        {/* —— Hero —— */}
        <motion.section
          className="projectlog-hero"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.33, 0, 0.2, 1] }}
        >
          <div className="projectlog-hero-grid">
            <div className="projectlog-hero-left">
              <div className="projectlog-crumbs mono">
                <span className="projectlog-crumb-channel">
                  <span className="projectlog-crumb-dot" aria-hidden />
                  {channelLabel} · PROJECT
                </span>
                {project.date ? (
                  <>
                    <span className="projectlog-crumb-sep" aria-hidden>·</span>
                    <span className="projectlog-crumb-date">{project.date}</span>
                  </>
                ) : null}
              </div>

              <h1 className="projectlog-title">{project.title}</h1>

              {project.tags.length > 0 ? (
                <div className="projectlog-tags">
                  {project.tags.map((t) => (
                    <span key={t} className="projectlog-tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              {project.description ? (
                <div className="projectlog-description">
                  <MarkdownBlock markdown={project.description} />
                </div>
              ) : null}

              <div className="projectlog-hero-actions">
                {project.link ? (
                  <a
                    className="projectlog-cta projectlog-cta--primary"
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit project externally <span aria-hidden>↗</span>
                  </a>
                ) : null}
                <a
                  className="projectlog-cta projectlog-cta--ghost mono"
                  href="#build-log"
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById('build-log')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  ↓ JUMP TO BUILD LOG ({pad(entries.length)})
                </a>
              </div>
            </div>

            <div className="projectlog-hero-media">
              {project.images.length > 0 ? (
                <ImageCarousel
                  images={project.images}
                  altPrefix={project.title}
                  stackSize={project.stackSize ?? Math.min(project.images.length, 4)}
                  variant="cover"
                />
              ) : (
                <div className="projectlog-hero-empty mono">NO MEDIA</div>
              )}
            </div>
          </div>
        </motion.section>

        {/* —— Build log —— */}
        <motion.section
          id="build-log"
          className="projectlog-log"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.33, 0, 0.2, 1] }}
        >
          <header className="projectlog-log-head">
            <div className="projectlog-log-title">
              <span className="projectlog-log-title-icon mono" aria-hidden>
                <span className="projectlog-log-title-led" />
                LOG
              </span>
              <h2>Build log</h2>
              <span className="projectlog-log-counter mono">
                {pad(entries.length)} {entries.length === 1 ? 'ENTRY' : 'ENTRIES'}
              </span>
            </div>
            <p className="projectlog-log-sub mono">
              // chronological · newest first
            </p>
          </header>

          <BuildLog entries={entries} channelLabel={channelLabel} accent={accent} />
        </motion.section>

        {/* —— Next / prev + foot —— */}
        <section className="projectlog-nextprev">
          {prevProject ? (
            <Link
              to={`/log/${encodeURIComponent(prevProject.id)}`}
              className="projectlog-nextprev-card projectlog-nextprev-card--prev"
            >
              <span className="projectlog-nextprev-dir mono">← PREV PROJECT</span>
              <span className="projectlog-nextprev-title">{prevProject.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {nextProject ? (
            <Link
              to={`/log/${encodeURIComponent(nextProject.id)}`}
              className="projectlog-nextprev-card projectlog-nextprev-card--next"
            >
              <span className="projectlog-nextprev-dir mono">NEXT PROJECT →</span>
              <span className="projectlog-nextprev-title">{nextProject.title}</span>
            </Link>
          ) : (
            <div />
          )}
        </section>

        <footer className="projectlog-foot mono">
          <Link to="/log" className="projectlog-foot-link">
            ← ALL PROJECTS
          </Link>
          <span className="projectlog-foot-sep" aria-hidden>·</span>
          <Link to="/" className="projectlog-foot-link">
            MAIN BENCH (calvinhou.com)
          </Link>
          <span className="projectlog-foot-sep" aria-hidden>·</span>
          <button
            type="button"
            className="projectlog-foot-link projectlog-foot-link--button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↑ TOP
          </button>
        </footer>
      </main>
    </div>
  )
}

function BuildLog({ entries, channelLabel, accent }) {
  if (entries.length === 0) {
    return (
      <div className="projectlog-paper">
        <div className="projectlog-paper-edge projectlog-paper-edge--left" aria-hidden />
        <div className="projectlog-paper-edge projectlog-paper-edge--right" aria-hidden />
        <div className="projectlog-empty">
          <div className="projectlog-empty-icon mono" aria-hidden>◌</div>
          <div className="projectlog-empty-title">Radio silence on this channel</div>
          <p className="projectlog-empty-text">
            Nothing on the tape yet...{' '}
            <Link to="/log" className="projectlog-empty-link">channels</Link>{' '}
            for ones I couldn't shut up about.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="projectlog-paper">
      <div className="projectlog-paper-edge projectlog-paper-edge--left" aria-hidden />
      <div className="projectlog-paper-edge projectlog-paper-edge--right" aria-hidden />

      <div className="projectlog-stream-head mono" aria-hidden>
        <span>// BUILD LOG · {channelLabel}</span>
        <span>—— ↧ NEWEST FIRST ↧ ——</span>
      </div>

      <ol className="projectlog-entries">
        {entries.map((entry, idx) => {
          const { date, time } = formatEntryDate(entry.dateIso, entry.date)
          const entryNumber = entries.length - idx
          return (
            <motion.li
              key={entry.id}
              className="projectlog-entry"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.32,
                ease: [0.33, 0, 0.2, 1],
                delay: Math.min(idx * 0.04, 0.3),
              }}
              style={{ '--entry-accent': accent }}
            >
              <div className="projectlog-entry-card">
                <header className="projectlog-entry-head">
                  <div className="projectlog-entry-tape mono">
                    <span className="projectlog-entry-num">
                      ENTRY {pad(entryNumber)}
                    </span>
                    <span className="projectlog-entry-sep" aria-hidden>·</span>
                    <span className="projectlog-entry-date">{date}</span>
                    {time ? (
                      <>
                        <span className="projectlog-entry-sep" aria-hidden>·</span>
                        <span className="projectlog-entry-time">{time}</span>
                      </>
                    ) : null}
                  </div>
                </header>

                <div className="projectlog-entry-body">
                  <h3 className="projectlog-entry-title">{entry.title}</h3>

                  {entry.summary ? (
                    <p className="projectlog-entry-summary">{entry.summary}</p>
                  ) : null}

                  {entry.body ? (
                    <div className="projectlog-entry-text">
                      <MarkdownBlock markdown={entry.body} />
                    </div>
                  ) : null}

                  {entry.images.length > 0 ? (
                    <div className="projectlog-entry-gallery">
                      <ImageCarousel
                        images={entry.images}
                        altPrefix={entry.title}
                        stackSize={entry.stackSize ?? Math.min(entry.images.length, 3)}
                        variant="cover"
                      />
                    </div>
                  ) : null}

                  {entry.tags.length > 0 ? (
                    <div className="projectlog-entry-tags">
                      {entry.tags.map((t) => (
                        <span key={t} className="projectlog-entry-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {idx < entries.length - 1 ? (
                <div className="projectlog-perforation" aria-hidden />
              ) : null}
            </motion.li>
          )
        })}
      </ol>

      <div className="projectlog-stream-foot mono" aria-hidden>
        —— END OF TAPE ——
      </div>
    </div>
  )
}
