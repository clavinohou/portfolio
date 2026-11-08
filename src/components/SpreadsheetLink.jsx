import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ImageCarousel.css'
import './SpreadsheetLink.css'
import { trackEvent } from '../lib/analytics'

const loading = <p className="spreadsheet-message" role="status">Loading workbook…</p>
const unavailable = <p className="spreadsheet-message" role="alert">The preview could not open this workbook. You can download the Excel file above.</p>

function SpreadsheetDialog({ href, title, onClose }) {
  const dialog = useRef(null)
  const closeButton = useRef(null)
  const titleId = useId()
  const [viewer, setViewer] = useState(null)

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
    closeButton.current.focus()

    let active = true
    import('./SpreadsheetWorkbook')
      .then(({ default: Workbook }) => {
        if (active) setViewer({ Component: Workbook })
      })
      .catch(() => {
        if (active) setViewer({ Component: null })
      })

    return () => { active = false }
  }, [])

  const Viewer = viewer?.Component
  return createPortal(
    <dialog
      ref={dialog}
      role="dialog"
      aria-labelledby={titleId}
      className="media-lightbox__panel spreadsheet-dialog"
      onClose={onClose}
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) dialog.current.close()
      }}
    >
      <header className="media-lightbox__chrome">
        <div className="media-lightbox__heading">
          <span className="media-lightbox__eyebrow">Spreadsheet viewer</span>
          <h2 className="media-lightbox__title" id={titleId}>{title}</h2>
        </div>
        <a className="spreadsheet-download" href={href} download>Download Excel</a>
        <button
          ref={closeButton}
          className="media-lightbox__close"
          type="button"
          aria-label="Close workbook"
          onClick={() => dialog.current.close()}
        >
          ×
        </button>
      </header>
      {Viewer ? <Viewer href={href} loading={loading} unavailable={unavailable} /> : viewer ? unavailable : loading}
    </dialog>,
    document.body,
  )
}

export function SpreadsheetLink({ href, title, ...props }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <a
        {...props}
        href={href}
        title={title}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          event.stopPropagation()
          trackEvent('workbook_open')
          setOpen(true)
        }}
      />
      {open && <SpreadsheetDialog href={href} title={title || 'Workbook preview'} onClose={() => setOpen(false)} />}
    </>
  )
}
