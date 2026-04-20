import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { siteContent } from '../content/siteContent'
import { publicUrl } from '../utils/publicUrl'
import { Link } from '../router'
import './BlogHome.css'

// Rotating trace palette shared with ProjectPage so each project's accent is
// stable across the site (CH1 orange, CH2 yellow, CH3 blue, …).
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

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return DATE_FORMATTER.format(d).toUpperCase()
}

function pad(n, w = 3) {
  return n.toString().padStart(w, '0')
}

export default function BlogHome() {
  const { projects, blog, profile, links } = siteContent

  const stats = useMemo(() => {
    const byProject = new Map()
    let latestMs = 0
    let latestIso = ''
    for (const entry of blog) {
      if (entry.project) {
        const next = (byProject.get(entry.project) || { count: 0, latestMs: 0, latestIso: '' })
        next.count += 1
        if (entry.dateMs > next.latestMs) {
          next.latestMs = entry.dateMs
          next.latestIso = entry.dateIso
        }
        byProject.set(entry.project, next)
      }
      if (entry.dateMs > latestMs) {
        latestMs = entry.dateMs
        latestIso = entry.dateIso
      }
    }
    return { byProject, total: blog.length, latestIso }
  }, [blog])

  return (
    <div className="bloghome">
      <Nav />

      <div className="bloghome-clip" aria-hidden>
        <span className="bloghome-clip-spring" />
        <span className="bloghome-clip-spring" />
        <span className="bloghome-clip-spring" />
      </div>

      <main className="bloghome-page">
        {/* —— Hero —— */}
        <motion.section
          className="bloghome-hero"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.33, 0, 0.2, 1] }}
        >
          <div className="bloghome-hero-stamp mono" aria-hidden>
            <span className="bloghome-hero-stamp-row">
              <span className="bloghome-hero-stamp-label">NOTEBOOK #</span>
              <span className="bloghome-hero-stamp-value">LB-01</span>
            </span>
            <span className="bloghome-hero-stamp-row">
              <span className="bloghome-hero-stamp-label">OWNER</span>
              <span className="bloghome-hero-stamp-value">
                {profile.name || 'C. HOU'}
              </span>
            </span>
            <span className="bloghome-hero-stamp-row">
              <span className="bloghome-hero-stamp-label">REV</span>
              <span className="bloghome-hero-stamp-value">B</span>
            </span>
          </div>

          <h1 className="bloghome-title">
            <span className="bloghome-title-kicker mono">HOU-LB01 · LAB NOTEBOOK</span>
            <span className="bloghome-title-main">Build Log</span>
          </h1>

          <p className="bloghome-lede">
            An engineering notebook kept alongside the
            {' '}
            <Link to="/" className="bloghome-lede-link">main bench</Link>.
            Short, honest entries about what I'm building — the failures, the
            fixes, the calculations that actually held up — filed by project
            like strips torn off a chart recorder.
          </p>

          <div className="bloghome-stats mono" aria-label="Notebook statistics">
            <div className="bloghome-stat">
              <span className="bloghome-stat-label">PROJECTS</span>
              <span className="bloghome-stat-value">{pad(projects.length, 2)}</span>
            </div>
            <div className="bloghome-stat">
              <span className="bloghome-stat-label">ENTRIES</span>
              <span className="bloghome-stat-value">{pad(stats.total, 3)}</span>
            </div>
            <div className="bloghome-stat">
              <span className="bloghome-stat-label">LAST UPDATE</span>
              <span className="bloghome-stat-value">{formatDate(stats.latestIso) || '—'}</span>
            </div>
          </div>
        </motion.section>

        {/* —— Project panel —— */}
        <section className="bloghome-section" id="projects">
          <header className="bloghome-section-head">
            <span className="bloghome-section-rule" aria-hidden />
            <h2 className="bloghome-section-title mono">PROJECT INDEX</h2>
            <span className="bloghome-section-hint mono">
              {pad(projects.length, 2)} CHANNELS · click a card to open the log
            </span>
          </header>

          {projects.length === 0 ? (
            <div className="bloghome-empty">
              <p>No projects yet.</p>
            </div>
          ) : (
            <div className="bloghome-grid">
              {projects.map((p, idx) => {
                const accent = TRACE_COLORS[idx % TRACE_COLORS.length]
                const ch = `CH${idx + 1}`
                const meta = stats.byProject.get(p.id)
                const entryCount = meta?.count ?? 0
                const lastDate = meta?.latestIso ? formatDate(meta.latestIso) : ''
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.33, 0, 0.2, 1],
                      delay: Math.min(0.18 + idx * 0.05, 0.5),
                    }}
                  >
                    <Link
                      to={`/log/${encodeURIComponent(p.id)}`}
                      className="bloghome-card"
                      style={{ '--card-accent': accent }}
                      aria-label={`Open ${p.title} build log`}
                    >
                      <div className="bloghome-card-media">
                        {p.images[0] ? (
                          <img
                            src={publicUrl(p.images[0])}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="bloghome-card-media-empty mono">NO COVER</div>
                        )}
                        <div className="bloghome-card-chip mono" aria-hidden>
                          <span className="bloghome-card-chip-dot" />
                          {ch}
                        </div>
                      </div>

                      <div className="bloghome-card-body">
                        <div className="bloghome-card-top mono">
                          <span className="bloghome-card-ch">{ch}</span>
                          {p.date ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="bloghome-card-date">{p.date}</span>
                            </>
                          ) : null}
                        </div>

                        <h3 className="bloghome-card-title">{p.title}</h3>

                        {p.tags.length > 0 ? (
                          <ul className="bloghome-card-tags" aria-label="Project tags">
                            {p.tags.slice(0, 4).map((t) => (
                              <li key={t} className="bloghome-card-tag">
                                {t}
                              </li>
                            ))}
                            {p.tags.length > 4 ? (
                              <li className="bloghome-card-tag bloghome-card-tag--more">
                                +{p.tags.length - 4}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}

                        <div className="bloghome-card-foot">
                          <div className="bloghome-card-foot-meta mono">
                            <span className="bloghome-card-log">
                              <span className="bloghome-card-log-led" aria-hidden />
                              <span className="bloghome-card-log-count">
                                {pad(entryCount, 2)}
                              </span>
                              <span className="bloghome-card-log-label">
                                {entryCount === 1 ? 'ENTRY' : 'ENTRIES'}
                              </span>
                            </span>
                            {lastDate ? (
                              <span className="bloghome-card-latest">
                                LAST · {lastDate}
                              </span>
                            ) : (
                              <span className="bloghome-card-latest bloghome-card-latest--empty">
                                NO ENTRIES YET
                              </span>
                            )}
                          </div>
                          <span className="bloghome-card-open mono" aria-hidden>
                            OPEN LOG →
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* —— Foot —— */}
        <footer className="bloghome-foot mono">
          <Link to="/" className="bloghome-foot-link">
            ← BACK TO MAIN BENCH (calvinhou.com)
          </Link>
          <span className="bloghome-foot-sep" aria-hidden>·</span>
          {links.email ? (
            <a
              href={`mailto:${links.email}`}
              className="bloghome-foot-link"
            >
              {links.email}
            </a>
          ) : null}
          {links.github ? (
            <>
              <span className="bloghome-foot-sep" aria-hidden>·</span>
              <a
                href={links.github}
                className="bloghome-foot-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub ↗
              </a>
            </>
          ) : null}
        </footer>
      </main>
    </div>
  )
}

/** Sticky top nav shared with the project page. */
export function Nav({ variant = 'home' }) {
  return (
    <header className="bloghome-nav">
      <div className="bloghome-nav-left">
        <Link to="/" className="bloghome-nav-back mono">
          <span className="bloghome-nav-back-arrow" aria-hidden>←</span>
          <span>MAIN PAGE</span>
        </Link>
      </div>

      <div className="bloghome-nav-center mono" aria-hidden>
        <span className="bloghome-nav-plate">HOU-LB01</span>
        <span className="bloghome-nav-sep">·</span>
        <span className="bloghome-nav-plate-sub">LAB NOTEBOOK</span>
      </div>

      <div className="bloghome-nav-right">
        <span className="bloghome-nav-rec mono" aria-hidden>
          <span className="bloghome-nav-rec-led" />
          <span>REC</span>
        </span>
        {variant === 'project' ? (
          <Link to="/log" className="bloghome-nav-home mono">
            ALL PROJECTS →
          </Link>
        ) : null}
      </div>
    </header>
  )
}
