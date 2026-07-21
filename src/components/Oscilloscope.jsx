import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { siteContent } from '../content/siteContent'
import { publicUrl } from '../utils/publicUrl'
import { ImageCarousel } from './ImageCarousel'
import { MarkdownBlock } from './MarkdownBlock'
import { ErrorBoundary } from './ErrorBoundary'
import { Link } from '../router'
import './Oscilloscope.css'

// Module-level cache of already-preloaded image URLs. Survives component
// remounts (e.g. hot module replacement, route changes) so images only get
// warmed once per page load.
const preloadCache = new Set()

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
    const y = complexWaveY(x)
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

// Front-panel scales run from coarse to fine as the knob turns clockwise,
// matching the gain/timebase behavior of a real scope.
const TIME_DIV_OPTIONS = [
  { label: '10 ms', seconds: 10e-3 },
  { label: '1 ms', seconds: 1e-3 },
  { label: '100 μs', seconds: 100e-6 },
  { label: '10 μs', seconds: 10e-6 },
  { label: '1 μs', seconds: 1e-6 },
  { label: '100 ns', seconds: 100e-9 },
  { label: '10 ns', seconds: 10e-9 },
  { label: '1 ns', seconds: 1e-9 },
]
const VOLTS_DIV_OPTIONS = [
  { label: '500 mV', volts: 500e-3 },
  { label: '200 mV', volts: 200e-3 },
  { label: '100 mV', volts: 100e-3 },
  { label: '50 mV', volts: 50e-3 },
  { label: '20 mV', volts: 20e-3 },
  { label: '10 mV', volts: 10e-3 },
  { label: '5 mV', volts: 5e-3 },
  { label: '2 mV', volts: 2e-3 },
]

function formatSeconds(seconds) {
  const magnitude = Math.abs(seconds)
  if (magnitude < 0.5e-9) return '0 s'
  if (magnitude < 1e-6) return `${(seconds * 1e9).toFixed(magnitude < 10e-9 ? 1 : 0)} ns`
  if (magnitude < 1e-3) return `${(seconds * 1e6).toFixed(magnitude < 10e-6 ? 1 : 0)} μs`
  if (magnitude < 1) return `${(seconds * 1e3).toFixed(magnitude < 10e-3 ? 1 : 0)} ms`
  return `${seconds.toFixed(magnitude < 10 ? 1 : 0)} s`
}

function formatVolts(volts) {
  const magnitude = Math.abs(volts)
  if (magnitude < 0.5e-3) return '0 V'
  if (magnitude < 1) return `${(volts * 1e3).toFixed(magnitude < 10e-3 ? 1 : 0)} mV`
  return `${volts.toFixed(magnitude < 10 ? 1 : 0)} V`
}

const COMPLEX_PERIOD = 200
const COMPLEX_COMPONENTS = [
  { harmonic: 2, amplitude: 15, phase: 0 },
  { harmonic: 5, amplitude: 7, phase: 0.85 },
  { harmonic: 11, amplitude: 3.5, phase: -0.4 },
]

function rawComplexWaveY(x) {
  let value = 0
  for (const component of COMPLEX_COMPONENTS) {
    value +=
      component.amplitude *
      Math.sin((x / COMPLEX_PERIOD) * 2 * Math.PI * component.harmonic + component.phase)
  }
  return value
}

let complexPeak = 1
for (let x = 0; x <= COMPLEX_PERIOD; x += 0.05) {
  complexPeak = Math.max(complexPeak, Math.abs(rawComplexWaveY(x)))
}
const COMPLEX_GAIN = 22 / complexPeak

function complexWaveY(x) {
  return 50 + rawComplexWaveY(x) * COMPLEX_GAIN
}

function sampledWaveLimits(waveFn, period) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let x = 0; x <= period; x += 0.02) {
    const y = waveFn(x)
    min = Math.min(min, y)
    max = Math.max(max, y)
  }
  return { min, max, period }
}

const WAVE_LIMITS = [
  { min: 27, max: 73, period: 24 },
  { min: 22, max: 78, period: 55 },
  sampledWaveLimits(complexWaveY, COMPLEX_PERIOD),
]

/** Find the rising-voltage crossing (decreasing SVG y) used to lock the trace. */
function risingCrossingX(shapeIndex, rawTriggerY) {
  if (shapeIndex === 0) {
    const ratio = Math.min(1, Math.max(-1, (rawTriggerY - 50) / 23))
    return ((Math.PI - Math.asin(ratio)) / (2 * Math.PI)) * 24
  }
  if (shapeIndex === 1) return 55 / 2

  let previousX = 0
  let previousY = complexWaveY(previousX)
  for (let x = 0.2; x <= COMPLEX_PERIOD; x += 0.2) {
    const y = complexWaveY(x)
    if (previousY >= rawTriggerY && y <= rawTriggerY) {
      const span = previousY - y || 1
      return previousX + ((previousY - rawTriggerY) / span) * (x - previousX)
    }
    previousX = x
    previousY = y
  }
  return 0
}

function voltsGainFromNorm(t) {
  return 0.35 + t * 1.65
}

function timeScaleFromNorm(t) {
  return 0.3 + t * 1.7
}

/** Continuous 0–1 knob: drag to rotate (analog-style) */
function ScopeKnobDial({ label, value, valueLabel, onChange, ariaLabel }) {
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
      aria-valuetext={valueLabel}
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
      <span className="scope-knob-text mono">
        <span>{label}</span>
        {valueLabel ? <span className="scope-knob-value">{valueLabel}</span> : null}
      </span>
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
          const inBuildLog = p.showInBuildLog !== false
          // The card is always the same visual block; only the wrapper element
          // and the footer CTA change based on how the project routes:
          //   • in build log  → <Link to="/log/:id">  (internal)
          //   • external only → <a href={p.link}>     (hidden from build log)
          //   • neither       → <div>                 (inert info card)
          const cardInner = (
            <>
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
                  {inBuildLog && entryCount > 0 ? (
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
                  {p.summary ? (
                    <p>{p.summary}</p>
                  ) : (
                    <MarkdownBlock markdown={p.description} />
                  )}
                </div>
                <div className="project-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="project-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="project-card-footer">
                  {inBuildLog ? (
                    <>
                      <span className="project-card-open mono">OPEN BUILD LOG →</span>
                      {p.link ? (
                        <a
                          className="project-external-link"
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            // This <a> sits inside the card's outer <Link>
                            // (also an <a>). Nested anchors are invalid HTML
                            // and browsers handle them inconsistently — the
                            // outer href can still fire on left click. Cancel
                            // both anchors' default navigation, stop React
                            // bubbling, and open the external URL ourselves.
                            // Only intercept plain left clicks so cmd/ctrl/
                            // middle-click still use the browser's native
                            // "open in new tab" behaviour.
                            if (e.button !== 0) return
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                            e.preventDefault()
                            e.stopPropagation()
                            window.open(p.link, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          External ↗
                        </a>
                      ) : null}
                    </>
                  ) : p.link ? (
                    <span className="project-card-open mono">VISIT PROJECT ↗</span>
                  ) : null}
                </div>
              </div>
            </>
          )

          if (inBuildLog) {
            return (
              <Link
                key={p.id}
                to={`/log/${encodeURIComponent(p.id)}`}
                className="project-card project-card--clickable"
                aria-label={`Open ${p.title} build log`}
              >
                {cardInner}
              </Link>
            )
          }
          if (p.link) {
            return (
              <a
                key={p.id}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="project-card project-card--clickable"
                aria-label={`Visit ${p.title}`}
              >
                {cardInner}
              </a>
            )
          }
          return (
            <div key={p.id} className="project-card">
              {cardInner}
            </div>
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
                <MarkdownBlock markdown={x.description} />
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
  // Start in the "booting" state on first mount so the screen plays the
  // warm-up animation (like an old CRT coming to life). Once the boot finishes
  // it settles into the normal "on" state and the power button can be used.
  const [powerState, setPowerState] = useState('booting')
  const powerTimerRef = useRef(null)
  const [triggerLevel, setTriggerLevel] = useState(1)
  const [knobVolts, setKnobVolts] = useState(0.5)
  const [knobVPos, setKnobVPos] = useState(0.5)
  const [knobSec, setKnobSec] = useState(0.5)
  const [knobHPos, setKnobHPos] = useState(0.5)
  const [waveInputSlug, setWaveInputSlug] = useState('ch1')
  const triggerSlotRef = useRef(null)
  const triggerDraggingRef = useRef(false)
  const wavePhaseGroupRef = useRef(null)
  const streamPhaseRef = useRef(0)
  // Per-project build log counts, shown as a small chip on each project card.
  const blogEntryCountsByProject = useMemo(() => {
    const counts = new Map()
    for (const entry of siteContent.blog || []) {
      if (!entry.project) continue
      counts.set(entry.project, (counts.get(entry.project) || 0) + 1)
    }
    return counts
  }, [])

  // Per-channel media URL buckets so we can prioritise the channels the user
  // is most likely to open first (projects → experience), and so hovering a
  // channel button can boost the priority for exactly that channel.
  const mediaByChannel = useMemo(() => {
    const coversFirst = (items) => {
      const covers = []
      const rest = []
      for (const it of items) {
        const imgs = it.images || []
        if (imgs[0]) covers.push(imgs[0])
        for (let i = 1; i < imgs.length; i++) rest.push(imgs[i])
      }
      return [...covers, ...rest]
    }
    return {
      projects: coversFirst(siteContent.projects),
      experience: coversFirst(siteContent.experience),
    }
  }, [])

  const allMediaUrls = useMemo(() => {
    // Order matters: covers of projects, then covers of experience, then the
    // rest, then dedupe so every URL only gets preloaded once.
    return [...new Set([...mediaByChannel.projects, ...mediaByChannel.experience].filter(Boolean))]
  }, [mediaByChannel])

  // Controller for the preload worker pool; lets us push URLs to the front
  // on hover for snappier channel switches.
  const preloadCtrlRef = useRef(null)

  const isHome = activeChannel == null
  const isPoweredOn = powerState !== 'off'
  const currentChannel = activeChannel ?? 'about'

  const togglePower = useCallback(() => {
    // Ignore clicks while any transition animation is running (including the
    // first-load "booting" warm-up).
    if (
      powerState === 'turning-off' ||
      powerState === 'turning-on' ||
      powerState === 'booting'
    ) {
      return
    }
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

  // Drive the first-load "booting" animation: hold the state for a beat
  // longer than a manual power-on to mimic a tube actually warming up, then
  // settle into the normal on state.
  useEffect(() => {
    if (powerState !== 'booting') return undefined
    const BOOT_DURATION_MS = 1150
    const id = window.setTimeout(() => setPowerState('on'), BOOT_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [powerState])

  // —— Parallel media preloader ————————————————————————————————————
  // The old implementation waited 1.2s, then loaded one image at a time with
  // 95ms gaps — so hitting "Projects" within ~5s of page load meant the
  // browser was still fetching/decoding, which caused the visible jitter.
  //
  // This version:
  //   • fires on the next animation frame (no idle delay)
  //   • runs CONCURRENCY workers in parallel
  //   • calls img.decode() so raster work happens OFF the main thread
  //   • remembers preloaded URLs in a module-level Set, so re-mounts are free
  //   • exposes a "boost" fn that moves URLs to the front of the queue —
  //     called on channel-button hover to warm up that channel's images
  //     before the click actually lands.
  useEffect(() => {
    if (allMediaUrls.length === 0) {
      preloadCtrlRef.current = null
      return undefined
    }

    let cancelled = false
    const CONCURRENCY = 6
    let active = 0
    const queue = []
    const queued = new Set()

    const enqueue = (urls, { front = false } = {}) => {
      const fresh = []
      for (const raw of urls) {
        if (!raw) continue
        const resolved = publicUrl(raw)
        if (preloadCache.has(resolved) || queued.has(resolved)) continue
        queued.add(resolved)
        fresh.push(resolved)
      }
      if (fresh.length === 0) return
      if (front) queue.unshift(...fresh)
      else queue.push(...fresh)
      pump()
    }

    const pump = () => {
      if (cancelled) return
      while (active < CONCURRENCY && queue.length > 0) {
        const url = queue.shift()
        active += 1
        const img = new Image()
        img.decoding = 'async'
        // Hint to the browser: this is a background warm-up, don't push out
        // anything user-critical that might be in flight.
        if ('fetchPriority' in img) img.fetchPriority = 'low'

        const done = () => {
          if (cancelled) return
          active -= 1
          preloadCache.add(url)
          queued.delete(url)
          pump()
        }
        img.onload = async () => {
          try {
            if (typeof img.decode === 'function') await img.decode()
          } catch {
            /* ignore decode failures */
          }
          done()
        }
        img.onerror = done
        img.src = url
      }
    }

    enqueue(allMediaUrls)

    // Defer one frame so we don't fight with the initial paint, but no more.
    const rafId = window.requestAnimationFrame(() => pump())

    preloadCtrlRef.current = {
      boost: (urls) => enqueue(urls, { front: true }),
    }

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      preloadCtrlRef.current = null
    }
  }, [allMediaUrls])

  const warmChannel = useCallback(
    (channelId) => {
      const urls = mediaByChannel[channelId]
      if (!urls || urls.length === 0) return
      preloadCtrlRef.current?.boost(urls)
    },
    [mediaByChannel],
  )

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

  const glowVar = isPoweredOn ? 0.68 : 0.03
  const voltsLabelIdx = Math.min(
    VOLTS_DIV_OPTIONS.length - 1,
    Math.round(knobVolts * (VOLTS_DIV_OPTIONS.length - 1)),
  )
  const secLabelIdx = Math.min(
    TIME_DIV_OPTIONS.length - 1,
    Math.round(knobSec * (TIME_DIV_OPTIONS.length - 1)),
  )
  const voltsOption = VOLTS_DIV_OPTIONS[voltsLabelIdx]
  const timeOption = TIME_DIV_OPTIONS[secLabelIdx]
  const offsetLabel = formatVolts((knobVPos - 0.5) * voltsOption.volts * 8)
  const delayLabel = formatSeconds((knobHPos - 0.5) * timeOption.seconds * 8)
  const triggerY = 92 - triggerLevel * 84
  const waveLimits = WAVE_LIMITS[selectedWave.shapeIndex]
  const displayedWaveMin = 50 + waveTransform.vGain * (waveLimits.min - 50) + waveTransform.vOff
  const displayedWaveMax = 50 + waveTransform.vGain * (waveLimits.max - 50) + waveTransform.vOff
  const triggerLocked =
    isPoweredOn && triggerY >= displayedWaveMin - 0.5 && triggerY <= displayedWaveMax + 0.5
  const rawTriggerY = (triggerY - waveTransform.vOff - 50) / waveTransform.vGain + 50
  const lockedPhase = 110 - risingCrossingX(selectedWave.shapeIndex, rawTriggerY)

  const updateTriggerFromPointer = useCallback((event) => {
    const rect = triggerSlotRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return
    const y = Math.min(rect.bottom, Math.max(rect.top, event.clientY))
    const svgY = ((y - rect.top) / rect.height) * 100
    setTriggerLevel(Math.min(1, Math.max(0, (92 - svgY) / 84)))
  }, [])

  const startTriggerDrag = useCallback(
    (event) => {
      event.preventDefault()
      triggerDraggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      updateTriggerFromPointer(event)
    },
    [updateTriggerFromPointer],
  )

  const moveTrigger = useCallback(
    (event) => {
      if (!triggerDraggingRef.current) return
      updateTriggerFromPointer(event)
    },
    [updateTriggerFromPointer],
  )

  const endTriggerDrag = useCallback((event) => {
    triggerDraggingRef.current = false
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      /* Pointer capture may already have been released by the browser. */
    }
  }, [])

  // A triggered sweep is phase-locked. If the level moves beyond the signal,
  // update the SVG transform directly on animation frames so the React tree is
  // not re-rendered continuously while the trace free-runs.
  useEffect(() => {
    const group = wavePhaseGroupRef.current
    if (!group) return undefined

    if (triggerLocked || !isPoweredOn) {
      streamPhaseRef.current = lockedPhase
      group.setAttribute('transform', `translate(${lockedPhase} 0)`)
      return undefined
    }

    let frameId = 0
    let lastTime = performance.now()
    const period = waveLimits.period
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      group.setAttribute('transform', `translate(${streamPhaseRef.current} 0)`)
      return undefined
    }

    const tick = (now) => {
      const elapsedSeconds = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const baseSpeed = 28 / Math.max(0.3, waveTransform.hScale)
      let nextPhase = streamPhaseRef.current - elapsedSeconds * baseSpeed
      while (nextPhase < lockedPhase - period) nextPhase += period
      streamPhaseRef.current = nextPhase
      group.setAttribute('transform', `translate(${nextPhase.toFixed(3)} 0)`)
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [isPoweredOn, lockedPhase, triggerLocked, waveLimits.period, waveTransform.hScale])

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

                      <div className="scope-crt-wave-slot" ref={triggerSlotRef}>
                        <svg
                          className="scope-wave"
                          viewBox="0 0 220 100"
                          preserveAspectRatio="none"
                          overflow="visible"
                          aria-hidden="true"
                        >
                          <g transform={`translate(${waveTransform.hOff} ${waveTransform.vOff})`}>
                            <g transform={`translate(110 50) scale(${waveTransform.hScale} ${waveTransform.vGain}) translate(-110 -50)`}>
                              <g ref={wavePhaseGroupRef}>
                                <path
                                  d={waveBase}
                                  className={`scope-wave-path ${selectedWave.shapeIndex !== 1 ? 'scope-wave-path--smooth' : ''}`}
                                  shapeRendering="geometricPrecision"
                                />
                              </g>
                            </g>
                          </g>
                        </svg>
                        <button
                          type="button"
                          className={`scope-trigger-marker ${triggerLocked ? 'is-locked' : 'is-searching'}`}
                          style={{ top: `${triggerY}%` }}
                          aria-label={`Trigger level, ${Math.round(triggerLevel * 100)} percent. Drag vertically to adjust.`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(triggerLevel * 100)}
                          onPointerDown={startTriggerDrag}
                          onPointerMove={moveTrigger}
                          onPointerUp={endTriggerDrag}
                          onPointerCancel={endTriggerDrag}
                          onLostPointerCapture={endTriggerDrag}
                          onKeyDown={(event) => {
                            const step = event.shiftKey ? 0.05 : 0.02
                            if (event.key === 'ArrowUp') {
                              event.preventDefault()
                              setTriggerLevel((value) => Math.min(1, value + step))
                            } else if (event.key === 'ArrowDown') {
                              event.preventDefault()
                              setTriggerLevel((value) => Math.max(0, value - step))
                            }
                          }}
                        >
                          <svg viewBox="0 0 18 14" aria-hidden="true">
                            <path d="M17 7H7M11 2 6 7l5 5" />
                          </svg>
                          <span className="scope-trigger-marker-label mono">T</span>
                        </button>
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
                  {voltsOption.label}/div
                </span>
                <span className={`scope-hscale-center ${triggerLocked ? 'is-locked' : 'is-searching'}`}>
                  {triggerLocked ? 'TRIG’D' : 'AUTO · SCANNING'} · {selectedWave.label} · EDGE ↑
                </span>
                <span>
                  {timeOption.label}/div
                </span>
              </div>
            </div>

            {/* Right control column */}
            <div className="scope-controls-column">
              <div className="scope-controls-section scope-controls-section--trigger">
                <span className="scope-section-label mono">TRIGGER</span>
                <div className="scope-knob-grid scope-knob-grid--single">
                  <ScopeKnobDial
                    label="LEVEL"
                    value={triggerLevel}
                    valueLabel={`${Math.round(triggerLevel * 100)}%`}
                    onChange={setTriggerLevel}
                    ariaLabel="Trigger level — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--vertical">
                <span className="scope-section-label mono">VERTICAL</span>
                <div className="scope-knob-grid">
                  <ScopeKnobDial
                    label="SCALE"
                    value={knobVolts}
                    valueLabel={`${voltsOption.label}/div`}
                    onChange={setKnobVolts}
                    ariaLabel="Volts per division — drag to rotate (vertical gain)"
                  />
                  <ScopeKnobDial
                    label="OFFSET"
                    value={knobVPos}
                    valueLabel={offsetLabel}
                    onChange={setKnobVPos}
                    ariaLabel="Vertical offset — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--horizontal">
                <span className="scope-section-label mono">HORIZONTAL</span>
                <div className="scope-knob-grid scope-knob-grid-2">
                  <ScopeKnobDial
                    label="SCALE"
                    value={knobSec}
                    valueLabel={`${timeOption.label}/div`}
                    onChange={setKnobSec}
                    ariaLabel="Seconds per division — drag to rotate (timebase)"
                  />
                  <ScopeKnobDial
                    label="DELAY"
                    value={knobHPos}
                    valueLabel={delayLabel}
                    onChange={setKnobHPos}
                    ariaLabel="Horizontal delay — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--input scope-input-section">
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
                  onMouseEnter={() => warmChannel(id)}
                  onFocus={() => warmChannel(id)}
                  onTouchStart={() => warmChannel(id)}
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
