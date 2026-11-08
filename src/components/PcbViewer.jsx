import { useRef, useState } from 'react'
import './ImageCarousel.css'
import './PcbViewer.css'
import { trackEvent } from '../lib/analytics'

export function PcbViewer({ viewer, projectTitle }) {
  const [opened, setOpened] = useState(false)
  const dialog = useRef(null)
  const expandButton = useRef(null)
  const closeButton = useRef(null)

  function expand() {
    // Move the same dialog into the top layer without remounting the iframe.
    dialog.current.close()
    dialog.current.showModal()
    closeButton.current.focus()
  }

  function collapse() {
    dialog.current.close()
    dialog.current.show()
    expandButton.current.focus({ preventScroll: true })
  }

  return (
    <section id="pcb-design" className="pcb-viewer" aria-labelledby="pcb-design-title">
      <header className="pcb-viewer-head">
        <div>
          <span className="pcb-viewer-eyebrow mono">INSIDE THE BOARD · ALTIUM 365</span>
          <h2 id="pcb-design-title">PCB design</h2>
          <p>Explore the schematics, board layout, and 3D assembly.</p>
        </div>
        {opened ? (
          <div className="pcb-viewer-actions">
            <button ref={expandButton} type="button" className="projectlog-cta projectlog-cta--ghost" aria-haspopup="dialog" onClick={expand}>
              Expand viewer
            </button>
            <a className="projectlog-cta projectlog-cta--ghost" href={viewer.externalUrl} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
          </div>
        ) : null}
      </header>
      {opened ? (
        <div className="pcb-viewer-slot">
          <dialog
            open
            ref={dialog}
            className="media-lightbox__panel pcb-viewer-dialog"
            aria-label={`${projectTitle} PCB viewer`}
            onCancel={(event) => {
              event.preventDefault()
              collapse()
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget && dialog.current.matches(':modal')) collapse()
            }}
          >
            <header className="media-lightbox__chrome">
              <div className="media-lightbox__heading">
                <span className="media-lightbox__eyebrow">PCB viewer</span>
                <span className="media-lightbox__title">{projectTitle}</span>
              </div>
              <a className="pcb-viewer-external" href={viewer.externalUrl} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
              <button ref={closeButton} className="media-lightbox__close" type="button" aria-label="Close expanded PCB viewer" onClick={collapse}>×</button>
            </header>
            <div className="media-lightbox__viewport pcb-viewer-frame">
              <iframe src={viewer.src} title={`${projectTitle} — interactive PCB design`} allowFullScreen />
            </div>
          </dialog>
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
          <button type="button" className="projectlog-cta projectlog-cta--primary" onClick={() => { trackEvent('pcb_viewer_open'); setOpened(true) }}>Explore PCB <span aria-hidden>→</span></button>
          <span className="pcb-viewer-note">Interactive viewer powered by Altium 365</span>
        </div>
      )}
      {opened ? <p className="pcb-viewer-help">Use the tabs inside the viewer to switch views. If the design doesn’t appear, try opening it in a new tab.</p> : null}
    </section>
  )
}
