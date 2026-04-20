import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { siteContent } from '../content/siteContent'
import { publicUrl } from '../utils/publicUrl'
import { ImageCarousel } from './ImageCarousel'
import { MarkdownBlock } from './MarkdownBlock'
import { ErrorBoundary } from './ErrorBoundary'
import { Link } from '../router'
import './Oscilloscope.css'

const fallbackImageUrl =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
      '<rect width="100%" height="100%" fill="#E8E8E8"/>' +
      '<path d="M0 300 C100 250 200 350 300 300 S500 250 600 300" fill="none" stroke="#FF6B35" stroke-width="8" opacity="0.4"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="24" fill="#525252">ADD IMAGE</text>' +
    '</svg>',
  )

const CHANNELS = [
  { id: 'about', ch: 'CH1', label: 'ABOUT' },
  { id: 'projects', ch: 'CH2', label: 'PROJECTS' },
  { id: 'resume', ch: 'CH3', label: 'RESUME' },
  { id: 'experience', ch: 'CH4', label: 'EXPERIENCE' },
]
const MODULE_IDS = ['about', 'projects', 'resume', 'experience', 'contact']

/** Waveform shape per front-panel input (matches physical jacks) */
const WAVE_INPUTS = [
  { slug: 'ch1', shapeIndex: 0, label: 'CH1', name: 'Sine' },
  { slug: 'ch2', shapeIndex: 1, label: 'CH2', name: 'Square' },
  { slug: 'ext', shapeIndex: 2, label: 'EXT TRIG', name: 'Complex' },
]

/** Wide X range so horizontal scale + pan never show an obvious “end” of the trace */
const WAVE_X0 = -520
const WAVE_X1 = 740

function tileSquareWavePath() {
  const P = 55
  const yLo = 78
  const yHi = 22
  const x0 = Math.floor(WAVE_X0 / P) * P
  const x1 = Math.ceil(WAVE_X1 / P) * P
  const parts = []
  let ox = x0
  parts.push(`M${ox},${yLo}`)
  while (ox < x1) {
    parts.push(`L${ox + P / 2},${yLo} L${ox + P / 2},${yHi} L${ox + P},${yHi} L${ox + P},${yLo}`)
    ox += P
  }
  return parts.join(' ')
}

/** Dense sampling + round stroke caps reads as a continuous scope trace (not faceted peaks). */
function tileSineWavePath() {
  const P = 24
  const amp = 23
  const step = 0.14
  const parts = []
  let i = 0
  for (let x = WAVE_X0; x <= WAVE_X1; x += step) {
    const y = 50 + amp * Math.sin((x / P) * 2 * Math.PI)
    const xf = Math.round(x * 100) / 100
    const yf = Math.round(y * 100) / 100
    parts.push(i === 0 ? `M${xf},${yf}` : `L${xf},${yf}`)
    i++
  }
  return parts.join(' ')
}

function tileComplexWavePath() {
  const step = 0.35
  const parts = []
  let i = 0
  for (let x = WAVE_X0; x <= WAVE_X1; x += step) {
    const y =
      50 +
      16 * Math.sin((x / 38) * 2 * Math.PI) +
      10 * Math.sin((x / 15) * 2 * Math.PI) +
      5 * Math.sin((x / 7) * 2 * Math.PI)
    const xf = Math.round(x * 100) / 100
    const yf = Math.round(Math.min(92, Math.max(8, y)) * 100) / 100
    parts.push(i === 0 ? `M${xf},${yf}` : `L${xf},${yf}`)
    i++
  }
  return parts.join(' ')
}

function waveformPath(shapeIndex) {
  switch (shapeIndex) {
    case 0:
      return tileSineWavePath()
    case 1:
      return tileSquareWavePath()
    default:
      return tileComplexWavePath()
  }
}

const TIME_DIV_LABELS = ['1 ns', '10 ns', '100 ns', '1 μs', '10 μs', '100 μs', '1 ms', '10 ms']
const VOLTS_DIV_LABELS = ['2 mV', '5 mV', '10 mV', '20 mV', '50 mV', '100 mV', '200 mV', '500 mV']

function voltsGainFromNorm(t) {
  return 0.35 + t * 1.65
}

function timeScaleFromNorm(t) {
  return 0.3 + t * 1.7
}

function plainFromMarkdown(markdown) {
  const text = String(markdown || '')
  return text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#-]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Continuous 0–1 knob: drag to rotate (analog-style) */
function ScopeKnobDial({ label, value, onChange, ariaLabel }) {
  const stackRef = useRef(null)
  const dragging = useRef(false)
  const lastAngle = useRef(null)

  const rotationDeg = -135 + value * 270

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging.current || !stackRef.current) return
      const rect = stackRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx)
      const last = lastAngle.current
      if (last == null) {
        lastAngle.current = angle
        return
      }
      let delta = angle - last
      if (delta > Math.PI) delta -= 2 * Math.PI
      if (delta < -Math.PI) delta += 2 * Math.PI
      lastAngle.current = angle

      const fullRange = (270 * Math.PI) / 180
      const deltaNorm = delta / fullRange
      onChange((v) => Math.min(1, Math.max(0, v + deltaNorm * 1.35)))
    },
    [onChange],
  )

  const endDrag = useCallback((e) => {
    dragging.current = false
    lastAngle.current = null
    try {
      if (e?.currentTarget?.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const startDrag = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    lastAngle.current = null
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = stackRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      lastAngle.current = Math.atan2(e.clientY - cy, e.clientX - cx)
    }
  }, [])

  return (
    <button
      type="button"
      className="scope-knob"
      aria-label={ariaLabel ?? label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={startDrag}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.05 : 0.02
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault()
          onChange((v) => Math.min(1, v + step))
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault()
          onChange((v) => Math.max(0, v - step))
        }
      }}
    >
      <span className="scope-knob-stack" ref={stackRef} aria-hidden="true">
        <span className="scope-knob-ring" />
        <span className="scope-knob-dial" style={{ transform: `rotate(${rotationDeg}deg)` }}>
          <span className="scope-knob-indicator" />
        </span>
      </span>
      <span className="scope-knob-text mono">{label}</span>
    </button>
  )
}

const ModuleCard = ({ title, subtitle, children }) => (
  <div className="module-card">
    <div className="module-card-header">
      <div className="module-title">{title}</div>
      {subtitle ? <div className="module-subtitle">{subtitle}</div> : null}
    </div>
    <div className="module-card-body">{children}</div>
  </div>
)

const AboutModule = () => {
  const { profile } = siteContent
  return (
    <ModuleCard title="ABOUT ME" subtitle={profile.title}>
      <div className="module-two">
        <div className="module-left">
          <div className="module-stat-grid">
            <div className="module-stat">
              <span className="module-stat-label">SCHOOL</span>
              <span className="module-stat-value">{profile.school}</span>
            </div>
            <div className="module-stat">
              <span className="module-stat-label">LOCATION</span>
              <span className="module-stat-value">{profile.location}</span>
            </div>
            <div className="module-stat">
              <span className="module-stat-label">YEAR</span>
              <span className="module-stat-value">{profile.year}</span>
            </div>
          </div>
          <div className="module-interests">
            <div className="module-section-label">INTERESTS</div>
            <div className="module-tag-row">
              {profile.interests.map((t) => (
                <span key={t} className="module-tag">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="module-right">
          {profile.about.map((p, idx) => (
            <div key={idx} className="module-paragraph">
              <MarkdownBlock markdown={p} />
            </div>
          ))}
        </div>
      </div>
    </ModuleCard>
  )
}

const ProjectsModule = ({
  mediaReady = true,
  mediaVisibleCount = Number.POSITIVE_INFINITY,
  blogEntryCountsByProject = null,
}) => {
  const { projects } = siteContent
  return (
    <ModuleCard
      title="PROJECTS"
      subtitle={
        <>
          Open a project to read its build log — or{' '}
          <Link to="/log" className="projects-subtitle-link mono">
            visit the full Build Log ↗
          </Link>
        </>
      }
    >
      <div className="project-grid">
        {projects.map((p, idx) => {
          const entryCount = blogEntryCountsByProject?.get?.(p.id) ?? 0
          const href = `/log/${encodeURIComponent(p.id)}`
          return (
            <Link
              key={p.id}
              to={href}
              className="project-card project-card--clickable"
              aria-label={`Open ${p.title} build log`}
            >
              <div className="project-image">
                {p.images.length > 0 && mediaReady && idx < mediaVisibleCount ? (
                  <ImageCarousel images={p.images} altPrefix={p.title} stackSize={p.stackSize} />
                ) : p.images.length > 0 ? (
                  <div className="project-media-placeholder" aria-hidden="true" />
                ) : (
                  <img src={fallbackImageUrl} alt="" />
                )}
              </div>
              <div className="project-content">
                <div className="project-card-toprow">
                  <div className="project-title">{p.title}</div>
                  {entryCount > 0 ? (
                    <span
                      className="project-card-logchip mono"
                      title={`${entryCount} build log ${entryCount === 1 ? 'entry' : 'entries'}`}
                    >
                      <span className="project-card-logchip-led" aria-hidden />
                      <span className="project-card-logchip-count">
                        {String(entryCount).padStart(2, '0')}
                      </span>
                      <span className="project-card-logchip-label">LOG</span>
                    </span>
                  ) : null}
                </div>
                {p.date ? <span className="project-date">{p.date}</span> : null}
                <div className="project-desc">
                  <p>{plainFromMarkdown(p.description)}</p>
                </div>
                <div className="project-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="project-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="project-card-footer">
                  <span className="project-card-open mono">OPEN BUILD LOG →</span>
                  {p.link ? (
                    <a
                      className="project-external-link"
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      External ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </ModuleCard>
  )
}

const ResumeModule = () => {
  const { resume } = siteContent
  const pdfSrc = publicUrl(resume.downloadUrl)
  const lastUpdatedLabel = resume.lastUpdated
    ? (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(resume.lastUpdated)
        if (m) {
          const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
          return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        }
        return resume.lastUpdated
      })()
    : null

  return (
    <ModuleCard title="RESUME" subtitle="Spec sheet view">
      <div className="resume-grid">
        <div className="resume-left">
          {lastUpdatedLabel ? (
            <p className="resume-last-updated">
              Last updated: <span className="resume-last-updated__date">{lastUpdatedLabel}</span>
            </p>
          ) : null}
          <div className="resume-highlight-list">
            {resume.highlights.map((h) => (
              <div key={h} className="resume-highlight">
                <span className="resume-bullet">◆</span>
                <span>{h}</span>
              </div>
            ))}
          </div>
          <a className="module-cta" href={pdfSrc || resume.downloadUrl || '#'} {...(pdfSrc ? { download: true } : {})}>
            {resume.downloadLabel} →
          </a>
        </div>
        <div className="resume-right">
          {pdfSrc ? (
            <div className="resume-preview">
              <div className="resume-preview-header mono">Document preview</div>
              <div className="resume-preview-frame">
                <iframe title="Resume PDF preview" src={`${pdfSrc}#toolbar=0`} />
              </div>
              <p className="resume-preview-hint">
                Preview not loading?{' '}
                <a href={pdfSrc} target="_blank" rel="noopener noreferrer">
                  Open PDF in a new tab
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="resume-preview resume-preview--empty">
              <p className="resume-preview-hint">Add a resume PDF in the CMS (Resume → Resume PDF).</p>
            </div>
          )}
        </div>
      </div>
    </ModuleCard>
  )
}

const ExperienceModule = ({
  mediaReady = true,
  mediaVisibleCount = Number.POSITIVE_INFINITY,
}) => {
  const { experience } = siteContent
  return (
    <ModuleCard title="EXPERIENCE" subtitle="Timeline">
      <div className="experience-list">
        {experience.map((x, idx) => (
          <div key={x.id} className={`experience-item ${x.images.length > 0 ? 'experience-item--with-media' : ''}`}>
            {x.images.length > 0 && mediaReady && idx < mediaVisibleCount ? (
              <div className="experience-media">
                <ImageCarousel images={x.images} altPrefix={x.company} variant="contain" stackSize={x.stackSize} />
              </div>
            ) : x.images.length > 0 ? (
              <div className="experience-media">
                <div className="experience-media-placeholder" aria-hidden="true" />
              </div>
            ) : null}
            <div className="experience-body">
              <div className="experience-meta">
                <span className="experience-type">{x.type}</span>
                <span className="experience-date">{x.date}</span>
              </div>
              <div className="experience-title">{x.title}</div>
              <div className="experience-company">
                {x.company} · {x.location}
              </div>
              <div className="experience-desc">
                <p>{plainFromMarkdown(x.description)}</p>
              </div>
              <div className="experience-tags">
                {x.tags.map((t) => (
                  <span key={t} className="experience-tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  )
}

const ContactModule = () => {
  const { links } = siteContent
  const email = links.email || 'clavin@gatech.edu'

  const handleSubmit = (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') || ''
    const from = formData.get('from') || ''
    const message = formData.get('message') || ''

    const subject = encodeURIComponent(`Portfolio contact from ${name || 'visitor'}`)
    const body = encodeURIComponent(
      `Name: ${name}\nFrom: ${from}\n\nMessage:\n${message}`,
    )

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  return (
    <ModuleCard title="CONTACT" subtitle="Ways to reach me">
      <div className="contact-module">
        <div className="contact-module-left">
          <div className="module-section-label">DIRECT</div>
          <div className="contact-module-list">
            <a href={`mailto:${email}`} className="contact-module-link">
              <span className="contact-module-label">Email</span>
              <span className="contact-module-value">{email}</span>
            </a>
            {links.linkedin && (
              <a
                href={links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-module-link"
              >
                <span className="contact-module-label">LinkedIn</span>
                <span className="contact-module-value">View profile →</span>
              </a>
            )}
            {links.github && (
              <a
                href={links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-module-link"
              >
                <span className="contact-module-label">GitHub</span>
                <span className="contact-module-value">View repos →</span>
              </a>
            )}
            {links.instagram && (
              <a
                href={links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-module-link"
              >
                <span className="contact-module-label">Instagram</span>
                <span className="contact-module-value">View photos →</span>
              </a>
            )}
          </div>
        </div>
        <div className="contact-module-right">
          <div className="module-section-label">SEND A MESSAGE</div>
          <form className="contact-module-form" onSubmit={handleSubmit}>
            <label className="contact-module-field">
              <span>Your name</span>
              <input type="text" name="name" autoComplete="name" />
            </label>
            <label className="contact-module-field">
              <span>Where you’re from / org</span>
              <input type="text" name="from" />
            </label>
            <label className="contact-module-field">
              <span>Message</span>
              <textarea name="message" rows={4} required />
            </label>
            <button type="submit" className="module-cta contact-module-submit">
              Open email with details →
            </button>
          </form>
        </div>
      </div>
    </ModuleCard>
  )
}

const moduleMap = {
  about: AboutModule,
  projects: ProjectsModule,
  resume: ResumeModule,
  experience: ExperienceModule,
  contact: ContactModule,
}

export default function Oscilloscope({
  activeChannel,
  onChannelChange,
  onHome,
  direction,
}) {
  const [powerState, setPowerState] = useState('on')
  const powerTimerRef = useRef(null)
  const [knobIntensity, setKnobIntensity] = useState(0.5)
  const [knobVolts, setKnobVolts] = useState(0.5)
  const [knobVPos, setKnobVPos] = useState(0.5)
  const [knobSec, setKnobSec] = useState(0.5)
  const [knobHPos, setKnobHPos] = useState(0.5)
  const [waveInputSlug, setWaveInputSlug] = useState('ch1')
  // Per-project build log counts, shown as a small chip on each project card.
  const blogEntryCountsByProject = useMemo(() => {
    const counts = new Map()
    for (const entry of siteContent.blog || []) {
      if (!entry.project) continue
      counts.set(entry.project, (counts.get(entry.project) || 0) + 1)
    }
    return counts
  }, [])

  const allMediaUrls = useMemo(() => {
    const projectUrls = siteContent.projects.flatMap((p) => p.images || [])
    const experienceUrls = siteContent.experience.flatMap((x) => x.images || [])
    return [...new Set([...projectUrls, ...experienceUrls].filter(Boolean))]
  }, [])

  const isHome = activeChannel == null
  const isPoweredOn = powerState !== 'off'
  const currentChannel = activeChannel ?? 'about'

  const togglePower = useCallback(() => {
    if (powerState === 'turning-off' || powerState === 'turning-on') return
    if (powerTimerRef.current) {
      clearTimeout(powerTimerRef.current)
      powerTimerRef.current = null
    }

    if (powerState === 'on') {
      setPowerState('turning-off')
      powerTimerRef.current = setTimeout(() => {
        setPowerState('off')
        powerTimerRef.current = null
      }, 430)
    } else {
      setPowerState('turning-on')
      powerTimerRef.current = setTimeout(() => {
        setPowerState('on')
        powerTimerRef.current = null
      }, 560)
    }
  }, [powerState])

  useEffect(() => {
    let cancelled = false
    const queue = [...allMediaUrls]
    if (queue.length === 0) return undefined

    const preloadNext = () => {
      if (cancelled || queue.length === 0) return
      const nextUrl = queue.shift()
      if (!nextUrl) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode()
          }
        } catch {
          /* ignore decode failures */
        }
        if (cancelled) return
        window.setTimeout(preloadNext, 95)
      }
      img.onerror = () => {
        if (cancelled) return
        window.setTimeout(preloadNext, 95)
      }
      img.src = publicUrl(nextUrl)
    }

    const kickoff = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => preloadNext(), { timeout: 1500 })
      } else {
        window.setTimeout(preloadNext, 1200)
      }
    }

    kickoff()
    return () => {
      cancelled = true
    }
  }, [allMediaUrls])

  useEffect(() => {
    document.documentElement.classList.toggle('scope-home-no-scroll', isHome)
    document.documentElement.classList.toggle('projector-page-open', !isHome)
    return () => {
      document.documentElement.classList.remove('scope-home-no-scroll')
      document.documentElement.classList.remove('projector-page-open')
    }
  }, [isHome])

  useEffect(() => {
    return () => {
      if (powerTimerRef.current) clearTimeout(powerTimerRef.current)
    }
  }, [])

  const selectedWave = useMemo(
    () => WAVE_INPUTS.find((w) => w.slug === waveInputSlug) ?? WAVE_INPUTS[0],
    [waveInputSlug],
  )
  const waveBase = useMemo(() => waveformPath(selectedWave.shapeIndex), [selectedWave.shapeIndex])

  const waveTransform = useMemo(() => {
    const vGain = voltsGainFromNorm(knobVolts)
    const hScale = timeScaleFromNorm(knobSec)
    const vOff = (knobVPos - 0.5) * 40
    const hOff = (knobHPos - 0.5) * 88
    return { vGain, hScale, vOff, hOff }
  }, [knobVolts, knobSec, knobVPos, knobHPos])

  const glowVar = useMemo(() => (isPoweredOn ? 0.35 + knobIntensity * 0.65 : 0.03), [isPoweredOn, knobIntensity])

  const voltsLabelIdx = Math.min(VOLTS_DIV_LABELS.length - 1, Math.round(knobVolts * (VOLTS_DIV_LABELS.length - 1)))
  const secLabelIdx = Math.min(TIME_DIV_LABELS.length - 1, Math.round(knobSec * (TIME_DIV_LABELS.length - 1)))

  const { profile, links } = siteContent

  const scopeTransition = { duration: 0.52, ease: [0.33, 0, 0.2, 1] }
  const projectorTransition = { duration: 0.52, ease: [0.33, 0, 0.2, 1] }
  const moduleMotionVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
  }
  const moduleMotionTransition = { duration: 0.24, ease: 'easeOut' }

  return (
    <div className={`bench-stage ${isHome ? 'bench-stage--home' : ''}`}>
      {/* “Table” surface behind everything */}
      <div className="bench-surface" aria-hidden="true" />

      <motion.div
        className="scope-rig"
        animate={{ x: 0, y: isHome ? 0 : 'min(78vh, 640px)' }}
        transition={{
          ...scopeTransition,
          delay: isHome ? 0.48 : 0,
        }}
      >
        <div className="scope-chassis">
          {/* Top strip: model + power */}
          <div className="scope-chassis-top">
            <div className="scope-model-block">
              <span className="scope-model-name">HOU-1002</span>
              <span className="scope-model-sub">DUAL TRACE · 100 MHz</span>
            </div>
            <button
              type="button"
              className={`scope-power-cluster state-${powerState}`}
              onClick={togglePower}
              aria-pressed={isPoweredOn}
              aria-label={isPoweredOn ? 'Turn oscilloscope off' : 'Turn oscilloscope on'}
            >
              <span className="scope-power-led" />
              <span className="scope-power-label">POWER</span>
            </button>
          </div>

          <div className={`scope-power-body ${isPoweredOn ? 'is-on' : 'is-off'}`}>
            <div className="scope-chassis-main">
            {/* CRT assembly */}
            <div className="scope-crt-column">
              <div className="scope-crt-bezel">
                <div className="scope-crt-glass">
                  <div
                    className={`scope-phosphor state-${powerState}`}
                    style={{
                      '--scope-glow': String(glowVar),
                    }}
                  >
                    <div className="scope-screen-grid" />
                    <div className={`scope-crt-power-overlay state-${powerState}`} aria-hidden="true">
                      <span className="scope-crt-power-line" />
                      <span className="scope-crt-power-dot" />
                    </div>
                    <div className="scope-crt-layout">
                      <div className="scope-crt-upper">
                        <div className="scope-crt-name mono">{profile.name}</div>
                        <div className="scope-crt-title-line">{profile.title}</div>
                        <div className="scope-crt-meta mono">
                          <span className="scope-crt-meta-school">{profile.school}</span>
                          <span className="scope-crt-meta-sep" aria-hidden="true">
                            {' '}
                            ·{' '}
                          </span>
                          <span className="scope-crt-meta-loc">{profile.location}</span>
                          <span className="scope-crt-meta-sep" aria-hidden="true">
                            {' '}
                            ·{' '}
                          </span>
                          <span className="scope-crt-meta-year">{profile.year}</span>
                        </div>
                      </div>

                      <div className="scope-crt-wave-slot">
                        <svg
                          className="scope-wave"
                          viewBox="0 0 220 100"
                          preserveAspectRatio="none"
                          overflow="visible"
                          aria-hidden="true"
                        >
                          <g transform={`translate(${waveTransform.hOff} ${waveTransform.vOff})`}>
                            <g transform={`translate(110 50) scale(${waveTransform.hScale} ${waveTransform.vGain}) translate(-110 -50)`}>
                              <path
                                d={waveBase}
                                className={`scope-wave-path ${selectedWave.shapeIndex !== 1 ? 'scope-wave-path--smooth' : ''}`}
                                shapeRendering="geometricPrecision"
                              />
                            </g>
                          </g>
                        </svg>
                        <span className="scope-crt-trace-badge mono">{selectedWave.name}</span>
                      </div>

                      <div className="scope-crt-lower">
                        <div className="scope-crt-lower-label mono">SKILLS · INTERESTS</div>
                        <div className="scope-crt-tags">
                          {profile.interests.map((t) => (
                            <span key={t} className="scope-crt-tag">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="scope-crt-hint mono">CH1–CH4: PAGES · JACKS: WAVEFORM</div>
                  </div>
                </div>
              </div>
              {/* Horizontal scale under CRT */}
              <div className="scope-hscale mono">
                <span>
                  {VOLTS_DIV_LABELS[voltsLabelIdx]}/div
                </span>
                <span className="scope-hscale-center">TRIG CH1 · EDGE ↑</span>
                <span>
                  {TIME_DIV_LABELS[secLabelIdx]}/div
                </span>
              </div>
            </div>

            {/* Right control column */}
            <div className="scope-controls-column">
              <div className="scope-controls-section">
                <span className="scope-section-label mono">VERTICAL</span>
                <div className="scope-knob-grid">
                  <ScopeKnobDial
                    label="INT"
                    value={knobIntensity}
                    onChange={setKnobIntensity}
                    ariaLabel="Intensity — drag to rotate (trace brightness)"
                  />
                  <ScopeKnobDial
                    label="V/DIV"
                    value={knobVolts}
                    onChange={setKnobVolts}
                    ariaLabel="Volts per division — drag to rotate (vertical gain)"
                  />
                  <ScopeKnobDial
                    label="V-POS"
                    value={knobVPos}
                    onChange={setKnobVPos}
                    ariaLabel="Vertical position — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section">
                <span className="scope-section-label mono">HORIZONTAL</span>
                <div className="scope-knob-grid scope-knob-grid-2">
                  <ScopeKnobDial
                    label="SEC/DIV"
                    value={knobSec}
                    onChange={setKnobSec}
                    ariaLabel="Seconds per division — drag to rotate (timebase)"
                  />
                  <ScopeKnobDial
                    label="H-POS"
                    value={knobHPos}
                    onChange={setKnobHPos}
                    ariaLabel="Horizontal position — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-input-section">
                <span className="scope-section-label mono">INPUTS · WAVEFORM</span>
                <div className="scope-bnc-grid">
                  {WAVE_INPUTS.map((inp) => {
                    const active = waveInputSlug === inp.slug
                    return (
                      <button
                        key={inp.slug}
                        type="button"
                        className={`scope-bnc scope-bnc-selectable ${active ? 'active' : ''}`}
                        onClick={() => setWaveInputSlug(inp.slug)}
                        aria-pressed={active}
                        aria-label={`${inp.label} — ${inp.name}`}
                      >
                        <span className="scope-bnc-top">
                          <span className="scope-bnc-body" />
                          <span className={`scope-bnc-led ${active ? 'on' : ''}`} aria-hidden />
                        </span>
                        <span className="scope-bnc-label mono">{inp.label}</span>
                        <span className="scope-bnc-shape">{inp.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Channel buttons — front panel */}
            <div className="scope-channel-panel">
            {CHANNELS.map(({ id, ch, label }) => {
              const isActive = activeChannel === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`scope-ch-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onChannelChange(id)}
                  aria-pressed={isActive}
                  aria-label={`${ch} ${label}`}
                >
                  <span className="scope-ch-num mono">{ch}</span>
                  <span className="scope-ch-name">{label}</span>
                </button>
              )
            })}
            </div>

            <div className="scope-chassis-foot mono">
            <a href={`mailto:${links.email}`} className="scope-foot-link">
              {links.email}
            </a>
            <span className="scope-foot-sep">·</span>
            <a href={links.github} target="_blank" rel="noopener noreferrer" className="scope-foot-link">
              GitHub
            </a>
            <span className="scope-foot-sep">·</span>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="scope-foot-link">
              LinkedIn
            </a>
            {links.instagram && (
              <>
                <span className="scope-foot-sep">·</span>
                <a
                  href={links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="scope-foot-link"
                >
                  Instagram
                </a>
              </>
            )}
            <span className="scope-foot-sep">·</span>
            <button
              type="button"
              className="scope-foot-link scope-foot-link--button"
              onClick={() => onChannelChange('contact')}
            >
              Contact
            </button>
          </div>
          </div>
        </div>
      </motion.div>

      {/* Projector screen */}
      <motion.div
        className="projector-shell"
        initial={false}
        style={{ pointerEvents: isHome ? 'none' : 'auto' }}
        animate={{ y: isHome ? '100%' : '0%', x: 0 }}
        transition={{
          ...projectorTransition,
          delay: isHome ? 0 : 0.48,
        }}
      >
        <div className="projector-frame">
          <div className="projector-scroll">
            <header className="projector-bar">
              <button type="button" className="projector-back mono" onClick={onHome}>
                ↑ STOW SCREEN · RETURN TO SCOPE
              </button>
              <span className="projector-channel mono">
                {CHANNELS.find((c) => c.id === activeChannel)?.ch ?? ''}{' '}
                {CHANNELS.find((c) => c.id === activeChannel)?.label ?? ''}
              </span>
            </header>
            <div className="projector-screen-surface">
              <motion.div
                className="projector-inner"
                custom={direction}
                variants={moduleMotionVariants}
                initial="enter"
                animate="center"
                transition={moduleMotionTransition}
              >
                <ErrorBoundary>
                  <div className="projector-module-stack">
                    {MODULE_IDS.map((id) => {
                      const panelClass = `projector-module-panel ${currentChannel === id ? 'is-active' : ''}`
                      if (id === 'projects') {
                        return (
                          <div key={id} className={panelClass}>
                            <ProjectsModule
                              mediaReady={true}
                              mediaVisibleCount={Number.POSITIVE_INFINITY}
                              blogEntryCountsByProject={blogEntryCountsByProject}
                            />
                          </div>
                        )
                      }
                      if (id === 'experience') {
                        return (
                          <div key={id} className={panelClass}>
                            <ExperienceModule mediaReady={true} mediaVisibleCount={Number.POSITIVE_INFINITY} />
                          </div>
                        )
                      }
                      const ModuleComp = moduleMap[id]
                      if (!ModuleComp) return null
                      return (
                        <div key={id} className={panelClass}>
                          <ModuleComp />
                        </div>
                      )
                    })}
                  </div>
                </ErrorBoundary>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
