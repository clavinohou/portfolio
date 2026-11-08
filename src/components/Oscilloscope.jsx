import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { trackEvent, createAdjustmentTracker } from '../lib/analytics'
import { siteContent } from '../content/siteContent'
import { publicUrl } from '../utils/publicUrl'
import { thumbPreloadUrl } from '../utils/imageSources'
import { ImageCarousel } from './ImageCarousel'
import { MarkdownBlock } from './MarkdownBlock'
import { ErrorBoundary } from './ErrorBoundary'
import { Link } from '../router'
import { ScopeVectorScreen } from './ScopeVectorScreen'
import { SIGNALS, triggerScreenY, triggerLevelAtY, triggerForSignal, advanceAcquisition } from './scopeSignals.mjs'
import { PANEL_SURFACE_CSS } from './panelFinish.mjs'
import { ROCKER_HEIGHT, ROCKER_INSET, ROCKER_THICKNESS, ROCKER_BODY_DEPTH, ROCKER_FACE_DEPTH, ROCKER_TILT, ROCKER_FLAT_SHEAR, rockerPivotHeight } from './rockerMechanics.mjs'
import './Oscilloscope.css'

const loadScopeScene = () => import('./ScopeMaterialScene')
const ScopeMaterialScene = lazy(loadScopeScene)
const MATERIAL_SCENE_QUERY = '(min-width: 769px) and (min-aspect-ratio: 4/3)'

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

/** Waveform shape per front-panel rocker input. */
const WAVE_INPUTS = [
  { slug: 'ch1', shapeIndex: 0, label: 'CH1', name: 'Sine', color: '#62d487', symbol: 'M1 7C4.5 -.5 8.5 -.5 12 7S19.5 14.5 23 7' },
  { slug: 'ch2', shapeIndex: 1, label: 'CH2', name: 'Square', color: '#67b7f0', symbol: 'M1 11V3H9V11H17V3H23' },
  { slug: 'ch3', shapeIndex: 2, label: 'CH3', name: 'Complex', color: '#ff996b', symbol: 'M1 8C4 1 6 12 9 5S13 2 15 7S19 13 23 4' },
]

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

function voltsGainFromNorm(t) {
  return 0.35 + t * 1.65
}

function timeScaleFromNorm(t) {
  return 0.3 + t * 1.7
}

function useAdjustmentTracker(control, channel) {
  const tracker = useMemo(() => createAdjustmentTracker(control, channel), [control, channel])
  useEffect(() => () => tracker.flush(), [tracker])
  return tracker
}

/** Continuous 0–1 knob: drag to rotate (analog-style) */
function ScopeKnobDial({ label, value, valueLabel, onChange, onReset, ariaLabel, control, channel }) {
  const buttonRef = useRef(null)
  const stackRef = useRef(null)
  const dragging = useRef(false)
  const lastAngle = useRef(null)

  const valueRef = useRef(value)
  valueRef.current = value
  const tracker = useAdjustmentTracker(control, channel)
  const changeValue = useCallback((next, method) => {
    const previous = valueRef.current
    const updated = typeof next === 'function' ? next(previous) : next
    valueRef.current = updated
    tracker.record(previous, updated, method, method !== 'drag')
    onChange(updated)
  }, [onChange, tracker])

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
      changeValue((v) => Math.min(1, Math.max(0, v + deltaNorm * 1.35)), 'drag')
    },
    [changeValue],
  )

  const endDrag = useCallback((e) => {
    if (dragging.current) tracker.flush()
    dragging.current = false
    lastAngle.current = null
    try {
      if (e?.currentTarget?.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      /* ignore */
    }
  }, [tracker])

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

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault()
      const rawDelta = event.deltaY || event.deltaX
      if (!rawDelta) return

      // Normalize mouse-wheel lines and trackpad pixels to a controlled turn.
      const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
      const magnitude = Math.abs(rawDelta * modeScale)
      const step = Math.min(0.04, Math.max(0.005, magnitude * 0.0005))
      const direction = rawDelta < 0 ? 1 : -1
      changeValue((current) => Math.min(1, Math.max(0, current + direction * step)), 'wheel')
    },
    [changeValue],
  )

  useEffect(() => {
    const button = buttonRef.current
    if (!button) return undefined
    button.addEventListener('wheel', handleWheel, { passive: false })
    return () => button.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <button
      ref={buttonRef}
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
      onDoubleClick={onReset ? () => { tracker.record(valueRef.current, 0.5, 'reset'); tracker.flush(); onReset() } : undefined}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.05 : 0.02
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault()
          changeValue((v) => Math.min(1, v + step), 'keyboard')
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault()
          changeValue((v) => Math.max(0, v - step), 'keyboard')
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
          Explore a project — or{' '}
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
                  <ImageCarousel
                    images={p.images}
                    altPrefix={p.title}
                    stackSize={p.stackSize}
                    thumbSizes="(max-width: 640px) 90vw, (max-width: 900px) 140px, 160px"
                  />
                ) : p.images.length > 0 ? (
                  <div className="project-media-placeholder" aria-hidden="true" />
                ) : (
                  <img src={fallbackImageUrl} alt="" />
                )}
              </div>
              <div className="project-content">
                <div className="project-card-toprow">
                  <div className="project-title">{p.title}</div>
                  {inBuildLog && p.showBuildNotes && entryCount > 0 ? (
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
                      <span className="project-card-open mono">{p.showBuildNotes ? 'OPEN BUILD LOG →' : 'OPEN PROJECT →'}</span>
                      {p.link ? (
                        <a
                          className="project-external-link"
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
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
              <div key={p.id} className="project-card project-card--clickable">
                {cardInner}
                <Link
                  to={`/log/${encodeURIComponent(p.id)}`}
                  className="project-card-hitarea"
                  aria-label={`Open ${p.title} ${p.showBuildNotes ? 'build log' : 'project'}`}
                />
              </div>
            )
          }
          if (p.link) {
            return (
              <div key={p.id} className="project-card project-card--clickable">
                {cardInner}
                <a
                  href={p.link}
                  onClick={() => trackEvent('project_open', { project_id: p.id, link_location: 'external' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-card-hitarea"
                  aria-label={`Visit ${p.title}`}
                />
              </div>
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
          <a onClick={() => trackEvent('resume_download')} className="module-cta" href={pdfSrc || resume.downloadUrl || '#'} {...(pdfSrc ? { download: true } : {})}>
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
                <a onClick={() => trackEvent('resume_open')} href={pdfSrc} target="_blank" rel="noopener noreferrer">
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
          <div key={x.id} data-experience={x.id} className={`experience-item ${x.images.length > 0 ? 'experience-item--with-media' : ''}`}>
            {x.images.length > 0 && mediaReady && idx < mediaVisibleCount ? (
              <div className="experience-media">
                <ImageCarousel images={x.images} altPrefix={x.company} variant={x.galleryIsLogo ? 'logo' : 'contain'} stackSize={x.stackSize} />
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
              <div className="experience-heading">
                <div className="experience-title">{x.title}</div>
                {x.status ? <span className={`experience-status experience-status--${x.status}`}>
                  {x.status === 'future' ? 'Future' : 'Present'}
                </span> : null}
              </div>
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

    trackEvent('contact_email_compose', { contact_method: 'email', link_location: 'contact_form' })
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  return (
    <ModuleCard title="CONTACT" subtitle="Ways to reach me">
      <div className="contact-module">
        <div className="contact-module-left">
          <div className="module-section-label">DIRECT</div>
          <div className="contact-module-list">
            <a href={`mailto:${email}`} onClick={() => trackEvent('contact_click', { contact_method: 'email', link_location: 'contact_section' })} className="contact-module-link">
              <span className="contact-module-label">Email</span>
              <span className="contact-module-value">{email}</span>
            </a>
            {links.linkedin && (
              <a
                href={links.linkedin} onClick={() => trackEvent('contact_click', { contact_method: 'linkedin', link_location: 'contact_section' })}
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
                href={links.github} onClick={() => trackEvent('contact_click', { contact_method: 'github', link_location: 'contact_section' })}
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
                href={links.instagram} onClick={() => trackEvent('contact_click', { contact_method: 'instagram', link_location: 'contact_section' })}
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
  const [waveInputSlug, setWaveInputSlug] = useState('ch1')
  const [enabledInputs, setEnabledInputs] = useState(['ch1'])
  const triggerSource = waveInputSlug
  const [waveSettings, setWaveSettings] = useState(() => Object.fromEntries(
    WAVE_INPUTS.map((input, index) => [input.slug, {
      knobVolts: 0.5, knobVPos: [0.5, 0.2, 0.8][index], knobSec: 0.5, knobHPos: 0.5,
    }]),
  ))
  const { knobVolts, knobVPos, knobSec, knobHPos } = waveSettings[waveInputSlug]
  const updateWaveKnob = useCallback((key, next) => {
    setWaveSettings((settings) => {
      const current = settings[waveInputSlug]
      return { ...settings, [waveInputSlug]: {
        ...current, [key]: typeof next === 'function' ? next(current[key]) : next,
      } }
    })
  }, [waveInputSlug])
  const setKnobVolts = useCallback((next) => updateWaveKnob('knobVolts', next), [updateWaveKnob])
  const setKnobVPos = useCallback((next) => updateWaveKnob('knobVPos', next), [updateWaveKnob])
  const setKnobSec = useCallback((next) => updateWaveKnob('knobSec', next), [updateWaveKnob])
  const setKnobHPos = useCallback((next) => updateWaveKnob('knobHPos', next), [updateWaveKnob])
  const toggleInput = (slug) => {
    const next = enabledInputs.includes(slug)
      ? enabledInputs.filter((input) => input !== slug)
      : [...enabledInputs, slug]
    trackEvent('scope_input_toggle', { scope_channel: slug, input_state: next.includes(slug) ? 'on' : 'off' })
    setEnabledInputs(next)
  }
  const triggerSlotRef = useRef(null)
  const screenSurfaceRef = useRef({ pose: { x: 0, y: 0, depth: 1 }, render: null })
  const scopePlaneRef = useRef(null)
  const scopeChassisRef = useRef(null)
  const viewPointerRef = useRef(null)
  const [viewMode, setViewMode] = useState('2d')
  const [viewNotice, setViewNotice] = useState({ text: '', id: 0 })
  const [sceneMounted, setSceneMounted] = useState(false)
  const [spatialActive, setSpatialActive] = useState(false)
  const [materialReady, setMaterialReady] = useState(false)
  const [materialProgress, setMaterialProgress] = useState(0)
  const [materialEnabled, setMaterialEnabled] = useState(() => window.matchMedia(MATERIAL_SCENE_QUERY).matches)
  const preparationRequested = useRef(false)
  const reportMaterialProgress = useCallback((progress) => {
    setMaterialProgress((current) => Math.max(current, Math.min(0.98, progress)))
  }, [])
  const handleMaterialReady = useCallback((ready) => {
    setMaterialReady(ready)
    setMaterialProgress(ready ? 1 : 0)
    if (ready) setViewNotice((notice) => notice.text === '3D still loading...' ? { ...notice, text: '' } : notice)
  }, [])
  const prepare3D = useCallback(() => {
    if (!window.matchMedia(MATERIAL_SCENE_QUERY).matches || preparationRequested.current) return
    preparationRequested.current = true
    reportMaterialProgress(0.05)
    loadScopeScene().then(({ preloadScopeMaterials }) => {
      reportMaterialProgress(0.15)
      preloadScopeMaterials()
      setSceneMounted(true)
    }).catch(() => {
      preparationRequested.current = false
      setMaterialProgress(0)
    })
  }, [reportMaterialProgress])
  const viewFeedback = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const selectView = useCallback((mode) => {
    if (mode === '3d' && !window.matchMedia(MATERIAL_SCENE_QUERY).matches) {
      setViewNotice((notice) => ({ text: 'Screen too small', id: notice.id + 1 }))
      return
    }
    if (mode === '3d' && !materialReady) {
      setViewNotice((notice) => ({ text: '3D still loading...', id: notice.id + 1 }))
      prepare3D()
      return
    }
    setViewNotice((notice) => notice.text ? { ...notice, text: '' } : notice)
    if (mode !== viewMode) trackEvent('scope_view_change', { view_mode: mode })
    setViewMode(mode)
  }, [materialReady, prepare3D, viewMode])
  useEffect(() => {
    if (!viewNotice.text) return undefined
    viewFeedback.stop()
    if (!reduceMotion) viewFeedback.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.3 } })
    const timer = window.setTimeout(() => setViewNotice((notice) => ({ ...notice, text: '' })), 2200)
    return () => {
      window.clearTimeout(timer)
      viewFeedback.stop()
    }
  }, [viewNotice, reduceMotion, viewFeedback])
  useEffect(() => {
    const record = (event) => {
      viewPointerRef.current = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY }
    }
    const clear = () => { viewPointerRef.current = null }
    window.addEventListener('pointermove', record, { passive: true })
    window.addEventListener('pointerdown', record, true)
    window.addEventListener('blur', clear)
    document.documentElement.addEventListener('pointerleave', clear)
    return () => {
      window.removeEventListener('pointermove', record)
      window.removeEventListener('pointerdown', record, true)
      window.removeEventListener('blur', clear)
      document.documentElement.removeEventListener('pointerleave', clear)
    }
  }, [])
  const triggerDraggingRef = useRef(false)
  const triggerPositionDraggingRef = useRef(false)
  const acquisitionRef = useRef({ time: 0, capture: 0, remainder: 0 })
  const [scopeFit, setScopeFit] = useState({ scale: 1, width: 0, height: 0 })
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
  useEffect(() => {
    if (!isHome || !materialEnabled || sceneMounted) return undefined
    let idle = 0
    const timer = window.setTimeout(() => {
      const warm = () => { if (document.visibilityState === 'visible') prepare3D() }
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm, { timeout: 1000 })
      else idle = window.setTimeout(warm, 500)
    }, 350)
    return () => {
      clearTimeout(timer)
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle)
      else clearTimeout(idle)
    }
  }, [isHome, materialEnabled, sceneMounted, prepare3D])
  useEffect(() => {
    if (materialEnabled || !isHome) setViewNotice((notice) => notice.text ? { ...notice, text: '' } : notice)
  }, [materialEnabled, isHome])
  const isPoweredOn = powerState !== 'off'
  const currentChannel = activeChannel ?? 'about'

  useEffect(() => {
    const query = window.matchMedia(MATERIAL_SCENE_QUERY)
    const update = () => setMaterialEnabled(query.matches)
    query.addEventListener('change', update)
    update()
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (viewMode !== '3d') return
    // Both modes retain the physical instrument after its first reveal.
    setSceneMounted(true)
    setSpatialActive(true)
  }, [viewMode])

  useEffect(() => {
    if (materialReady && materialEnabled) setSpatialActive(true)
  }, [materialReady, materialEnabled])

  useEffect(() => {
    const switchView = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      if (isHome && (event.key === '2' || event.key === '3')) {
        event.preventDefault()
        selectView(event.key === '2' ? '2d' : '3d')
      }
    }
    window.addEventListener('keydown', switchView)
    return () => window.removeEventListener('keydown', switchView)
  }, [isHome, selectView])

  useLayoutEffect(() => {
    // Keep the fitted enclosure mounted at its current pose while it exits.
    if (!isHome) return undefined

    const chassis = scopeChassisRef.current
    if (!chassis) return undefined

    let frameId = 0
    const fitChassis = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight

        // Portrait layouts intentionally scroll. Landscape layouts keep the
        // complete front panel in one view, using the same uniform scale a
        // browser zoom-out would apply instead of squeezing either axis.
        if (viewportWidth / viewportHeight < 4 / 3) {
          setScopeFit({ scale: 1, width: 0, height: 0 })
          return
        }

        const naturalWidth = chassis.offsetWidth
        const naturalHeight = chassis.offsetHeight
        if (naturalWidth <= 0 || naturalHeight <= 0) return

        const horizontalPadding = Math.min(20, Math.max(8, viewportWidth * 0.02))
        const verticalPadding = Math.min(14, Math.max(6, Math.min(viewportWidth, viewportHeight) * 0.015))
        const scale = Math.min(
          1,
          (viewportWidth - horizontalPadding * 2 - 96) / naturalWidth,
          (viewportHeight - verticalPadding * 2 - 180) / naturalHeight,
        )
        const next = {
          scale,
          width: naturalWidth * scale,
          height: naturalHeight * scale,
        }
        setScopeFit((current) =>
          Math.abs(current.scale - next.scale) < 0.001 &&
          Math.abs(current.width - next.width) < 0.5 &&
          Math.abs(current.height - next.height) < 0.5
            ? current
            : next,
        )
      })
    }

    const resizeObserver = new ResizeObserver(fitChassis)
    resizeObserver.observe(chassis)
    window.addEventListener('resize', fitChassis)
    window.visualViewport?.addEventListener('resize', fitChassis)
    fitChassis()

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', fitChassis)
      window.visualViewport?.removeEventListener('resize', fitChassis)
    }
  }, [isHome])

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

    trackEvent('scope_power_toggle', { power_state: powerState === 'on' ? 'off' : 'on' })
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
        // Warm the derivative the card will actually paint, not the camera
        // original. Passing srcSet/sizes makes the preloader resolve the same
        // candidate the DOM will, so the warmed entry is the one that gets hit.
        const candidate = thumbPreloadUrl(raw)
        if (!candidate.src) continue
        if (preloadCache.has(candidate.src) || queued.has(candidate.src)) continue
        queued.add(candidate.src)
        fresh.push(candidate)
      }
      if (fresh.length === 0) return
      if (front) queue.unshift(...fresh)
      else queue.push(...fresh)
      pump()
    }

    const pump = () => {
      if (cancelled) return
      while (active < CONCURRENCY && queue.length > 0) {
        const { src, srcSet, sizes } = queue.shift()
        active += 1
        const img = new Image()
        img.decoding = 'async'
        // Hint to the browser: this is a background warm-up, don't push out
        // anything user-critical that might be in flight.
        if ('fetchPriority' in img) img.fetchPriority = 'low'

        const done = () => {
          if (cancelled) return
          active -= 1
          preloadCache.add(src)
          queued.delete(src)
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
        if (srcSet) {
          if (sizes) img.sizes = sizes
          img.srcset = srcSet
        }
        img.src = src
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
  const waves = useMemo(() => WAVE_INPUTS.map((input) => {
    const settings = waveSettings[input.slug]
    return { ...input, ...SIGNALS[input.shapeIndex], transform: {
      vGain: voltsGainFromNorm(settings.knobVolts),
      hScale: timeScaleFromNorm(settings.knobSec),
      vOff: (settings.knobVPos - 0.5) * 40,
      hOff: (settings.knobHPos - 0.5) * 176,
    } }
  }), [waveSettings])
  const visibleWaves = useMemo(() => waves.filter((wave) => enabledInputs.includes(wave.slug)), [waves, enabledInputs])
  const triggerWave = waves.find((wave) => wave.slug === triggerSource)
  const triggerTransform = triggerWave.transform
  const inputControls = useMemo(() => WAVE_INPUTS.map((input) => ({
    ...input, enabled: enabledInputs.includes(input.slug), selected: waveInputSlug === input.slug,
  })), [enabledInputs, waveInputSlug])

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
  const triggerY = triggerScreenY(triggerLevel)
  const trigger = useMemo(() => triggerForSignal(triggerWave.shapeIndex, triggerTransform, triggerY),
    [triggerWave.shapeIndex, triggerTransform, triggerY])
  const triggerX = 10 + waveSettings[triggerSource].knobHPos * 80
  const triggerLocked =
    isPoweredOn && enabledInputs.includes(triggerSource) &&
    trigger.locked

  const levelTracker = useAdjustmentTracker('trigger_level', waveInputSlug)
  const positionTracker = useAdjustmentTracker('horizontal_position', waveInputSlug)
  const triggerStart = useRef(0)
  const positionStart = useRef(0)

  const updateTriggerFromPointer = useCallback((event) => {
    const rect = triggerSlotRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return
    const y = Math.min(rect.bottom, Math.max(rect.top, event.clientY))
    const svgY = ((y - rect.top) / rect.height) * 100
    setTriggerLevel(triggerLevelAtY(svgY))
  }, [])

  const startTriggerDrag = useCallback(
    (event) => {
      event.preventDefault()
      triggerStart.current = triggerLevel
      triggerDraggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      updateTriggerFromPointer(event)
    },
    [updateTriggerFromPointer, triggerLevel],
  )

  const moveTrigger = useCallback(
    (event) => {
      if (!triggerDraggingRef.current) return
      updateTriggerFromPointer(event)
    },
    [updateTriggerFromPointer],
  )

  const endTriggerDrag = useCallback((event) => {
    if (triggerDraggingRef.current) {
      levelTracker.record(triggerStart.current, triggerLevel, 'drag', false)
      levelTracker.flush()
    }
    triggerDraggingRef.current = false
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      /* Pointer capture may already have been released by the browser. */
    }
  }, [levelTracker, triggerLevel])

  const updateTriggerPositionFromPointer = useCallback((event) => {
    const rect = triggerSlotRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const x = Math.min(rect.right, Math.max(rect.left, event.clientX))
    const screenPosition = (x - rect.left) / rect.width
    const next = Math.min(1, Math.max(0, (screenPosition - 0.1) / 0.8))
    setWaveSettings((settings) => ({ ...settings, [triggerSource]: { ...settings[triggerSource], knobHPos: next } }))
  }, [triggerSource])

  const startTriggerPositionDrag = useCallback(
    (event) => {
      event.preventDefault()
      positionStart.current = knobHPos
      triggerPositionDraggingRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      updateTriggerPositionFromPointer(event)
    },
    [updateTriggerPositionFromPointer, knobHPos],
  )

  const moveTriggerPosition = useCallback(
    (event) => {
      if (!triggerPositionDraggingRef.current) return
      updateTriggerPositionFromPointer(event)
    },
    [updateTriggerPositionFromPointer],
  )

  const endTriggerPositionDrag = useCallback((event) => {
    if (triggerPositionDraggingRef.current) {
      positionTracker.record(positionStart.current, knobHPos, 'drag', false)
      positionTracker.flush()
    }
    triggerPositionDraggingRef.current = false
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      /* Pointer capture may already have been released by the browser. */
    }
  }, [positionTracker, knobHPos])

  // Every displayed record has one timestamp shared by all channels. A
  // trigger advances records by complete cycles of its source; unrelated
  // signals keep their own phase at each of those capture times.
  useEffect(() => {
    if (!isHome || !enabledInputs.length || !isPoweredOn) return undefined

    const acquisition = acquisitionRef.current
    const settings = { locked: triggerLocked, crossing: trigger.crossing, period: trigger.period, hScale: triggerTransform.hScale }
    advanceAcquisition(acquisition, 0, settings)
    screenSurfaceRef.current.render?.()

    let frameId = 0
    let lastTime = performance.now()
    let lastDraw = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      screenSurfaceRef.current.render?.()
      return undefined
    }

    const tick = (now) => {
      if (document.hidden) {
        lastTime = now
        frameId = window.requestAnimationFrame(tick)
        return
      }
      const interval = Math.max(screenSurfaceRef.current.frameInterval || 0, triggerLocked ? 1000 / 30 : 0)
      if (now - lastDraw < interval) {
        frameId = window.requestAnimationFrame(tick)
        return
      }
      lastDraw = now
      const elapsedSeconds = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      advanceAcquisition(acquisition, elapsedSeconds, settings)
      screenSurfaceRef.current.render?.()
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [isHome, isPoweredOn, enabledInputs.length, trigger.crossing, trigger.period, triggerLocked, triggerTransform.hScale])

  const { profile, links } = siteContent

  const scopeTransition = { duration: 0.52, ease: [0.33, 0, 0.2, 1] }
  const projectorTransition = { duration: 0.52, ease: [0.33, 0, 0.2, 1] }
  const moduleMotionVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
  }
  const moduleMotionTransition = { duration: 0.24, ease: 'easeOut' }

  return (
    <div className="bench-stage bench-stage--home">
      {isHome ? (
        <div className="scope-view-toolbar" role="group" aria-label="Oscilloscope view">
          <span className="scope-view-load" role="progressbar" aria-label="3D loading progress"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(materialProgress * 100)}
            aria-valuetext={materialReady ? '3D ready' : 'Loading 3D'} hidden={!materialEnabled}
            style={{ '--load-progress': materialProgress }}
            data-state={materialReady ? 'ready' : 'loading'}
          ><span style={{ transform: `scaleX(${materialProgress})` }} /></span>
          <button type="button" aria-label="2D view" aria-pressed={viewMode === '2d' || !materialEnabled} onClick={() => selectView('2d')}>[2]</button>
          <motion.button type="button" aria-label="3D view" aria-pressed={viewMode === '3d' && materialEnabled} aria-disabled={!materialEnabled || !materialReady} aria-busy={materialEnabled && !materialReady} animate={viewFeedback} onPointerEnter={prepare3D} onFocus={prepare3D} onClick={() => selectView('3d')}>[3]</motion.button>
          <span className="scope-view-notice" role="status">{viewNotice.text}</span>
        </div>
      ) : null}
      {/* “Table” surface behind everything */}
      <div className="bench-surface" aria-hidden="true" />

      <motion.div
        className="scope-rig"
        data-frozen={isHome ? undefined : "true"}
        style={{ pointerEvents: isHome ? "auto" : "none" }}
        animate={{ x: 0, y: isHome ? 0 : 'min(78vh, 640px)' }}
        transition={{
          ...scopeTransition,
          delay: isHome ? 0.48 : 0,
        }}
      >
        <div
          data-material-enabled={materialEnabled}
          data-material-ready={materialReady}
          className={`scope-fit-frame ${scopeFit.width > 0 ? 'is-fitted' : ''} ${materialReady && materialEnabled && (viewMode === '3d' || spatialActive) ? 'has-depth-scene' : ''}`}
          style={
            scopeFit.width > 0
              ? { width: scopeFit.width, height: scopeFit.height }
              : undefined
          }
        >
        {(viewMode === '3d' || sceneMounted) && materialEnabled && scopeFit.width > 0 ? (
          <Suspense fallback={null}>
            <ScopeMaterialScene
              chassisRef={scopeChassisRef}
              planeRef={scopePlaneRef}
              surfaceRef={screenSurfaceRef}
              fit={scopeFit}
              isPoweredOn={isPoweredOn}
              inputs={inputControls}
              active={isHome}
              threeD={viewMode === '3d'}
              spatialActive={spatialActive || viewMode === '3d'}
              pointerRef={viewPointerRef}
              onReady={handleMaterialReady}
              onProgress={reportMaterialProgress}
            />
          </Suspense>
        ) : null}
        <div className="scope-front-plane" ref={scopePlaneRef}>
        <div
          ref={scopeChassisRef}
          className="scope-chassis"
          style={{
            '--scope-panel-surface': PANEL_SURFACE_CSS,
            transform: scopeFit.width > 0 ? `scale3d(${scopeFit.scale}, ${scopeFit.scale}, ${scopeFit.scale})` : undefined,
          }}
        >
          <div className="scope-front-hardware" aria-hidden="true">
            <div className="scope-front-handle">
              <span className="scope-front-handle-bar" />
              <span className="scope-front-handle-end is-left"><span className="scope-front-handle-axle" /><span className="scope-front-handle-pad" /></span>
              <span className="scope-front-handle-end is-right"><span className="scope-front-handle-axle" /><span className="scope-front-handle-pad" /></span>
            </div>
            <span className="scope-front-foot is-left" />
            <span className="scope-front-foot is-right" />
          </div>
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
                <span className="scope-crt-recess" aria-hidden="true" />
                <div className="scope-crt-glass">
                  <span className="scope-crt-optics" aria-hidden="true" />
                  <div className="scope-crt-image">
                  <div
                    className={`scope-phosphor state-${powerState}`}
                    style={{
                      '--scope-glow': String(glowVar),
                    }}
                  >
                    <ScopeVectorScreen
                      surfaceRef={screenSurfaceRef}
                      acquisitionRef={acquisitionRef}
                      waveSlotRef={triggerSlotRef}
                      waves={visibleWaves}
                      triggerColor={triggerWave.color}
                      triggerX={triggerX}
                      triggerY={triggerY}
                      triggerLocked={triggerLocked}
                      triggerSource={triggerSource}
                      powerState={powerState}
                    />
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

                      <div className="scope-crt-wave-slot" style={{ '--trigger-color': triggerWave.color }} ref={triggerSlotRef}>
                        <span
                          className={`scope-trigger-guide scope-trigger-position-guide ${triggerLocked ? 'is-locked' : 'is-searching'}`}
                          style={{ left: `${triggerX}%` }}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className="scope-trigger-position-marker"
                          style={{ left: `${triggerX}%` }}
                          aria-label={`Trigger position, ${Math.round(triggerX)} percent from the left. Drag horizontally to adjust; double-click to center.`}
                          aria-valuemin={10}
                          aria-valuemax={90}
                          aria-valuenow={Math.round(triggerX)}
                          onPointerDown={startTriggerPositionDrag}
                          onPointerMove={moveTriggerPosition}
                          onPointerUp={endTriggerPositionDrag}
                          onPointerCancel={endTriggerPositionDrag}
                          onLostPointerCapture={endTriggerPositionDrag}
                          onDoubleClick={() => { positionTracker.record(knobHPos, 0.5, 'reset'); positionTracker.flush(); setKnobHPos(0.5) }}
                          onKeyDown={(event) => {
                            const step = event.shiftKey ? 0.05 : 0.02
                            if (['ArrowRight', 'ArrowLeft', 'Home'].includes(event.key)) {
                              const next = event.key === 'Home' ? 0.5 : Math.min(1, Math.max(0, knobHPos + (event.key === 'ArrowRight' ? step : -step)))
                              positionTracker.record(knobHPos, next, 'keyboard')
                            }
                            if (event.key === 'ArrowRight') {
                              event.preventDefault()
                              setWaveSettings((settings) => ({ ...settings, [triggerSource]: { ...settings[triggerSource], knobHPos: Math.min(1, settings[triggerSource].knobHPos + step) } }))
                            } else if (event.key === 'ArrowLeft') {
                              event.preventDefault()
                              setWaveSettings((settings) => ({ ...settings, [triggerSource]: { ...settings[triggerSource], knobHPos: Math.max(0, settings[triggerSource].knobHPos - step) } }))
                            } else if (event.key === 'Home') {
                              event.preventDefault()
                              setWaveSettings((settings) => ({ ...settings, [triggerSource]: { ...settings[triggerSource], knobHPos: 0.5 } }))
                            }
                          }}
                        >
                          <span className="scope-trigger-hit" aria-hidden="true" />
                          <span className="scope-trigger-position-label mono">T</span>
                          <span className="scope-trigger-position-caret" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`scope-trigger-marker ${triggerLocked ? 'is-locked' : 'is-searching'}`}
                          style={{ top: `${triggerY}%` }}
                          aria-label={`Trigger level, ${Math.round(triggerLevel * 100)} percent. Drag vertically to adjust; double-click to set 50 percent.`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(triggerLevel * 100)}
                          onPointerDown={startTriggerDrag}
                          onPointerMove={moveTrigger}
                          onPointerUp={endTriggerDrag}
                          onPointerCancel={endTriggerDrag}
                          onLostPointerCapture={endTriggerDrag}
                          onDoubleClick={() => { levelTracker.record(triggerLevel, 0.5, 'reset'); levelTracker.flush(); setTriggerLevel(0.5) }}
                          onKeyDown={(event) => {
                            const step = event.shiftKey ? 0.05 : 0.02
                            if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                              const next = Math.min(1, Math.max(0, triggerLevel + (event.key === 'ArrowUp' ? step : -step)))
                              levelTracker.record(triggerLevel, next, 'keyboard')
                            }
                            if (event.key === 'ArrowUp') {
                              event.preventDefault()
                              setTriggerLevel((value) => Math.min(1, value + step))
                            } else if (event.key === 'ArrowDown') {
                              event.preventDefault()
                              setTriggerLevel((value) => Math.max(0, value - step))
                            }
                          }}
                        >
                          <span className="scope-trigger-hit" aria-hidden="true" />
                          <svg viewBox="0 0 18 14" aria-hidden="true">
                            <path d="M17 7H7M11 2 6 7l5 5" />
                          </svg>
                          <span className="scope-trigger-marker-label mono">T</span>
                        </button>
                        <span className="scope-crt-trace-badge mono">
                          {visibleWaves.map((wave) => <span key={wave.slug} style={{ color: wave.color }}>{wave.label} {wave.name}</span>)}
                          {!visibleWaves.length ? 'INPUTS OFF' : null}
                        </span>
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

                    <div className="scope-crt-hint mono">CH1–CH4: PAGES · SWITCHES: WAVEFORMS</div>
                  </div>
                  </div>
                </div>
              </div>
              {/* Horizontal scale under CRT */}
              <div className="scope-hscale mono">
                <span>
                  {voltsOption.label}/div
                </span>
                <span className={`scope-hscale-center ${triggerLocked ? 'is-locked' : 'is-searching'}`}>
                  {triggerLocked ? 'TRIG’D' : 'AUTO · SCANNING'} · {triggerWave.label}
                </span>
                <span>
                  {timeOption.label}/div
                </span>
              </div>
            </div>

            {/* Right control column */}
            <div className="scope-controls-column">
              <div className="scope-controls-section scope-controls-section--trigger">
                <span className="scope-section-label mono">TRIGGER · {selectedWave.label}</span>
                <div className="scope-trigger-row">
                  <ScopeKnobDial
                    label="LEVEL"
                    control="trigger_level"
                    channel={waveInputSlug}
                    value={triggerLevel}
                    valueLabel={`${Math.round(triggerLevel * 100)}%`}
                    onChange={setTriggerLevel}
                    onReset={() => setTriggerLevel(0.5)}
                    ariaLabel="Trigger level. Drag to rotate; double-click to set 50 percent."
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--vertical">
                <span className="scope-section-label mono">VERTICAL · {selectedWave.label}</span>
                <div className="scope-knob-grid">
                  <ScopeKnobDial
                    label="SCALE"
                    control="volts_per_division"
                    channel={waveInputSlug}
                    value={knobVolts}
                    valueLabel={`${voltsOption.label}/div`}
                    onChange={setKnobVolts}
                    ariaLabel="Volts per division — drag to rotate (vertical gain)"
                  />
                  <ScopeKnobDial
                    label="OFFSET"
                    control="vertical_offset"
                    channel={waveInputSlug}
                    value={knobVPos}
                    valueLabel={offsetLabel}
                    onChange={setKnobVPos}
                    ariaLabel="Vertical offset — drag to rotate"
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--horizontal">
                <span className="scope-section-label mono">HORIZONTAL · {selectedWave.label}</span>
                <div className="scope-knob-grid scope-knob-grid-2">
                  <ScopeKnobDial
                    label="SCALE"
                    control="seconds_per_division"
                    channel={waveInputSlug}
                    value={knobSec}
                    valueLabel={`${timeOption.label}/div`}
                    onChange={setKnobSec}
                    ariaLabel="Seconds per division — drag to rotate (timebase)"
                  />
                  <ScopeKnobDial
                    label="POSITION"
                    control="horizontal_position"
                    channel={waveInputSlug}
                    value={knobHPos}
                    valueLabel={delayLabel}
                    onChange={setKnobHPos}
                    onReset={() => setKnobHPos(0.5)}
                    ariaLabel="Horizontal trigger position. Drag to rotate; double-click to center."
                  />
                </div>
              </div>

              <div className="scope-controls-section scope-controls-section--input scope-input-section">
                <span className="scope-section-label mono">INPUTS · WAVEFORM</span>
                <div className="scope-input-grid">
                  {WAVE_INPUTS.map((input) => {
                    const enabled = enabledInputs.includes(input.slug)
                    const selected = waveInputSlug === input.slug
                    return <div
                      key={input.slug}
                      className={`scope-input-bank ${selected ? 'is-selected' : ''} ${enabled ? 'is-enabled' : ''}`}
                      style={{ '--input-color': input.color }}
                    >
                      <button type="button" className="scope-input-select"
                        data-channel={input.slug}
                        aria-label={`Control and trigger ${input.label} ${input.name}`}
                        aria-pressed={selected}
                        onClick={() => {
                          if (input.slug !== waveInputSlug) trackEvent('scope_channel_select', { scope_channel: input.slug })
                          setWaveInputSlug(input.slug)
                        }}
                      >{input.label}</button>
                      <button type="button" role="switch" className="scope-input-rocker"
                        data-input={input.slug}
                        style={{
                          '--rocker-height': `${ROCKER_HEIGHT}px`,
                          '--rocker-inset': `${ROCKER_INSET}px`,
                          '--rocker-half-depth': `${ROCKER_THICKNESS / 2}px`,
                          '--rocker-face-depth': `${ROCKER_FACE_DEPTH}px`,
                          '--rocker-body-depth': `${ROCKER_BODY_DEPTH}px`,
                          '--rocker-side-depth': `${ROCKER_BODY_DEPTH + ROCKER_FACE_DEPTH}px`,
                          '--rocker-flat-shear': ROCKER_FLAT_SHEAR,
                          '--rocker-pivot': `${rockerPivotHeight(ROCKER_HEIGHT)}px`,
                          '--rocker-tilt': `${ROCKER_TILT}rad`,
                        }}
                        aria-label={`${input.label} ${input.name} input`}
                        aria-checked={enabled}
                        onClick={() => toggleInput(input.slug)}
                      >
                        <span className="scope-rocker-seat" aria-hidden="true">
                          <span className="scope-rocker-lamp" />
                          <span className="scope-rocker-hinge" />
                        </span>
                        <span className="scope-rocker-spill" aria-hidden="true" />
                        <span className="scope-rocker-paddle" aria-hidden="true">
                          <span className="scope-rocker-side scope-rocker-side--left" />
                          <span className="scope-rocker-side scope-rocker-side--right" />
                          <span className="scope-rocker-edge scope-rocker-edge--top" />
                          <span className="scope-rocker-edge scope-rocker-edge--bottom" />
                          <span className="scope-rocker-face">
                            <span className="scope-rocker-on">ON</span>
                            <span className="scope-rocker-grip" />
                            <svg className="scope-rocker-symbol" viewBox="0 0 24 14">
                              <path d={input.symbol} />
                            </svg>
                            <span className="scope-rocker-grip" />
                            <span className="scope-rocker-off">OFF</span>
                          </span>
                        </span>
                      </button>
                      <span className="scope-input-name">{input.name}</span>
                    </div>
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
            <div className="scope-channel-shadows" aria-hidden="true">
              {CHANNELS.map(({ id }) => <span key={id} />)}
            </div>
            </div>

            <div className="scope-chassis-foot mono">
            <a href={`mailto:${links.email}`} onClick={() => trackEvent('contact_click', { contact_method: 'email', link_location: 'footer' })} className="scope-foot-link">
              {links.email}
            </a>
            <span className="scope-foot-sep">·</span>
            <a href={links.github} onClick={() => trackEvent('contact_click', { contact_method: 'github', link_location: 'footer' })} target="_blank" rel="noopener noreferrer" className="scope-foot-link">
              GitHub
            </a>
            <span className="scope-foot-sep">·</span>
            <a href={links.linkedin} onClick={() => trackEvent('contact_click', { contact_method: 'linkedin', link_location: 'footer' })} target="_blank" rel="noopener noreferrer" className="scope-foot-link">
              LinkedIn
            </a>
            {links.instagram && (
              <>
                <span className="scope-foot-sep">·</span>
                <a
                  href={links.instagram} onClick={() => trackEvent('contact_click', { contact_method: 'instagram', link_location: 'footer' })}
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
