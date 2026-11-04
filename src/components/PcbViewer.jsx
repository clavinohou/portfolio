import { useState } from 'react'
import './PcbViewer.css'

export function PcbViewer({ viewer, projectTitle }) {
  const [opened, setOpened] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <section id="pcb-design" className={`pcb-viewer${expanded ? ' pcb-viewer--expanded' : ''}`} aria-labelledby="pcb-design-title">
      <header className="pcb-viewer-head">
        <div>
          <span className="pcb-viewer-eyebrow mono">INSIDE THE BOARD · ALTIUM 365</span>
          <h2 id="pcb-design-title">PCB design</h2>
          <p>Explore the schematics, board layout, and 3D assembly.</p>
        </div>
        {opened ? (
          <div className="pcb-viewer-actions">
            <button type="button" className="projectlog-cta projectlog-cta--ghost" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Collapse viewer' : 'Expand viewer'}
            </button>
            <a className="projectlog-cta projectlog-cta--ghost" href={viewer.externalUrl} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
          </div>
        ) : null}
      </header>
      {opened ? (
        <div className="pcb-viewer-frame">
          <iframe src={viewer.src} title={`${projectTitle} — interactive PCB design`} allowFullScreen />
        </div>
      ) : (
        <div className="pcb-viewer-cover">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
            <rect x="12" y="12" width="48" height="48" rx="5" stroke="currentColor" strokeWidth="2" />
            <rect x="27" y="27" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M32 18v9m8-9v9m-8 18v9m8-9v9M18 32h9m-9 8h9m18-8h9m-9 8h9" stroke="currentColor" strokeWidth="2" />
          </svg>
          <h3>Take a closer look.</h3>
          <p>Pan, zoom, and inspect the actual design.</p>
          <button type="button" className="projectlog-cta projectlog-cta--primary" onClick={() => setOpened(true)}>Explore PCB <span aria-hidden>→</span></button>
          <span className="pcb-viewer-note">Interactive viewer powered by Altium 365</span>
        </div>
      )}
      {opened ? <p className="pcb-viewer-help">Use the tabs inside the viewer to switch views. If the design doesn’t appear, try opening it in a new tab.</p> : null}
    </section>
  )
}
