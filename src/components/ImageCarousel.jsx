import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { imageSources } from '../utils/imageSources'
import { publicUrl } from '../utils/publicUrl'
import './ImageCarousel.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.5

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function ImageCarouselBase({ images, altPrefix = 'Photo', variant = 'cover', stackSize, thumbSizes }) {
  const list = useMemo(
    () => (Array.isArray(images) ? images : []).map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean),
    [images],
  )
  const [i, setI] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [windowStart, setWindowStart] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [isPanning, setIsPanning] = useState(false)
  const stageRef = useRef(null)
  const closeButtonRef = useRef(null)
  const returnFocusRef = useRef(null)
  const panRef = useRef(null)
  const zoomAnchorRef = useRef(null)

  useEffect(() => {
    setI(0)
    setWindowStart(0)
    setZoom(MIN_ZOOM)
  }, [images])

  useEffect(() => {
    if (!expanded) return
    setZoom(MIN_ZOOM)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      document.body.style.overflow = prev
      returnFocusRef.current?.focus?.()
    }
  }, [expanded])

  useEffect(() => {
    setZoom(MIN_ZOOM)
    setIsPanning(false)
    if (stageRef.current) {
      stageRef.current.scrollLeft = 0
      stageRef.current.scrollTop = 0
    }
  }, [i])

  // Zooming scales the fitted image 1.5x, which outruns the 1600px derivative
  // on a HiDPI display, so the original is swapped in for that state only.
  // Fetching it is deferred past the lightbox's open spring — decoding a 12MP
  // photo is exactly the work that makes an in-flight animation stutter — and
  // the swap waits for the load so zooming never flashes an empty frame.
  const [readyOriginal, setReadyOriginal] = useState(null)
  const wantsOriginal = zoom > MIN_ZOOM

  useEffect(() => {
    if (!expanded) {
      setReadyOriginal(null)
      return undefined
    }
    const url = list[i]
    if (!url) return undefined
    const resolved = publicUrl(url)
    let cancelled = false
    const id = window.setTimeout(
      () => {
        const img = new Image()
        img.decoding = 'async'
        if ('fetchPriority' in img) img.fetchPriority = 'low'
        img.onload = () => {
          if (!cancelled) setReadyOriginal(resolved)
        }
        img.src = resolved
      },
      // Zoom is already showing the upscaled derivative, so fetch immediately.
      wantsOriginal ? 0 : 400,
    )
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [expanded, list, i, wantsOriginal])

  const n = list.length
  const maxSlots = typeof stackSize === 'number' && Number.isFinite(stackSize) && stackSize > 0 ? stackSize : n
  const visibleSlots = Math.min(maxSlots, n)

  const goPrev = useCallback(
    (e) => {
      e?.stopPropagation?.()
      setI((v) => (v - 1 + n) % n)
    },
    [n],
  )
  const goNext = useCallback(
    (e) => {
      e?.stopPropagation?.()
      setI((v) => (v + 1) % n)
    },
    [n],
  )

  const updateZoom = useCallback((nextZoom) => {
    const stage = stageRef.current
    if (stage) {
      zoomAnchorRef.current = {
        x: stage.scrollWidth > 0 ? (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth : 0.5,
        y: stage.scrollHeight > 0 ? (stage.scrollTop + stage.clientHeight / 2) / stage.scrollHeight : 0.5,
      }
    }
    setZoom((current) => {
      const next = clampZoom(typeof nextZoom === 'function' ? nextZoom(current) : nextZoom)
      return Math.round(next * 100) / 100
    })
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const anchor = zoomAnchorRef.current
    if (!stage || !anchor) return undefined
    const frame = window.requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(0, anchor.x * stage.scrollWidth - stage.clientWidth / 2)
      stage.scrollTop = Math.max(0, anchor.y * stage.scrollHeight - stage.clientHeight / 2)
      zoomAnchorRef.current = null
    })
    return () => window.cancelAnimationFrame(frame)
  }, [zoom])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev(e)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext(e)
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        updateZoom((value) => value + ZOOM_STEP)
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        updateZoom((value) => value - ZOOM_STEP)
      }
      if (e.key === '0') {
        e.preventDefault()
        updateZoom(MIN_ZOOM)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, goPrev, goNext, updateZoom])

  if (n === 0) return null

  const full = imageSources(list[i], { role: 'full' })
  const original = publicUrl(list[i])
  // Comparing against the resolved URL means a pending load for a previously
  // viewed image can never be mistaken for this one.
  const showOriginal = wantsOriginal && readyOriginal === original
  const rootClass = `media-carousel media-carousel--${variant}`

  // When the carousel (or its lightbox portal) is rendered inside a clickable
  // card — e.g. a project card wrapped in <Link> (an <a href>) — bare
  // stopPropagation isn't enough. preventDefault cancels the anchor's default
  // navigation, stopPropagation keeps the synthetic event from bubbling
  // through the React tree (which portals still do) into the parent Link.
  const swallowClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const openAt = (event, index) => {
    swallowClick(event)
    returnFocusRef.current = event.currentTarget
    setI(index)
    setExpanded(true)
  }

  const startPan = (event) => {
    if (zoom <= MIN_ZOOM || event.button !== 0) return
    event.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePan = (event) => {
    const start = panRef.current
    const stage = stageRef.current
    if (!start || !stage) return
    stage.scrollLeft = start.left - (event.clientX - start.x)
    stage.scrollTop = start.top - (event.clientY - start.y)
  }

  const endPan = (event) => {
    panRef.current = null
    setIsPanning(false)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  }

  // The lightbox is rendered into document.body via createPortal, but React's
  // synthetic events still bubble through the React tree — so clicks inside
  // the portal reach the parent card's <Link> anchor and fire navigation.
  // Every click handler in the lightbox calls swallowClick BEFORE doing its
  // thing so the event never reaches that anchor.
  const lightbox = (
    <AnimatePresence>
      {expanded && (
        <motion.div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${altPrefix} — full size`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={swallowClick}
        >
          <motion.div
            className="media-lightbox__backdrop"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              swallowClick(e)
              setExpanded(false)
            }}
          />
          <motion.div
            className="media-lightbox__panel"
            role="document"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={swallowClick}
          >
            <div className="media-lightbox__chrome">
              <div className="media-lightbox__heading">
                <span className="media-lightbox__eyebrow">Photo viewer</span>
                <span className="media-lightbox__title">{altPrefix}</span>
              </div>
              <div className="media-lightbox__zoom" role="group" aria-label="Zoom controls">
                <button
                  type="button"
                  className="media-lightbox__tool"
                  aria-label="Zoom out"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={(e) => {
                    swallowClick(e)
                    updateZoom((value) => value - ZOOM_STEP)
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  className="media-lightbox__zoom-value"
                  aria-label={`Reset zoom from ${Math.round(zoom * 100)} percent`}
                  disabled={zoom <= MIN_ZOOM}
                  onClick={(e) => {
                    swallowClick(e)
                    updateZoom(MIN_ZOOM)
                  }}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="media-lightbox__tool"
                  aria-label="Zoom in"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={(e) => {
                    swallowClick(e)
                    updateZoom((value) => value + ZOOM_STEP)
                  }}
                >
                  +
                </button>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="media-lightbox__close"
                aria-label="Close photo viewer"
                onClick={(e) => {
                  swallowClick(e)
                  setExpanded(false)
                }}
              >
                ×
              </button>
            </div>
            <div
              ref={stageRef}
              className={`media-lightbox__stage media-lightbox__stage--${variant} ${zoom > MIN_ZOOM ? 'is-zoomed' : ''} ${isPanning ? 'is-panning' : ''}`}
              onWheel={(event) => {
                if (Math.abs(event.deltaY) < 2) return
                event.preventDefault()
                updateZoom((value) => value + (event.deltaY < 0 ? 0.25 : -0.25))
              }}
            >
              {n > 1 && (
                <>
                  <button
                    type="button"
                    className="media-lightbox__nav media-lightbox__nav--prev"
                    aria-label="Previous"
                    onClick={(e) => {
                      swallowClick(e)
                      goPrev(e)
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="media-lightbox__nav media-lightbox__nav--next"
                    aria-label="Next"
                    onClick={(e) => {
                      swallowClick(e)
                      goNext(e)
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              <div className="media-lightbox__canvas">
                <motion.img
                  key={i}
                  {...(showOriginal
                    ? { src: original }
                    : { src: full.src, srcSet: full.srcSet, sizes: full.sizes })}
                  width={full.width}
                  height={full.height}
                  alt={`${altPrefix}, photo ${i + 1} of ${n}`}
                  decoding="async"
                  draggable={false}
                  className="media-lightbox__img"
                  style={{ '--media-zoom': zoom }}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onPointerDown={startPan}
                  onPointerMove={movePan}
                  onPointerUp={endPan}
                  onPointerCancel={endPan}
                  onLostPointerCapture={endPan}
                  onDoubleClick={(e) => {
                    swallowClick(e)
                    updateZoom((value) => (value > MIN_ZOOM ? MIN_ZOOM : 2))
                  }}
                />
              </div>
              <span className="media-lightbox__hint" aria-hidden="true">
                {zoom > MIN_ZOOM ? 'Drag to move · double-click to reset' : 'Double-click or scroll to zoom'}
              </span>
            </div>
            <div className="media-lightbox__footer">
              <span className="media-lightbox__counter" aria-live="polite">
                {i + 1} <span>/ {n}</span>
              </span>
              {n > 1 ? (
                <div className="media-lightbox__filmstrip" aria-label="Choose a photo">
                  {list.map((url, index) => {
                    const thumb = imageSources(url, { role: 'thumb', sizes: '64px' })
                    return (
                      <button
                        key={`${url}-lightbox-thumb`}
                        type="button"
                        className={`media-lightbox__filmstrip-item ${index === i ? 'is-active' : ''}`}
                        aria-label={`Show photo ${index + 1} of ${n}`}
                        aria-current={index === i ? 'true' : undefined}
                        onClick={(event) => {
                          swallowClick(event)
                          setI(index)
                        }}
                      >
                        <img
                          src={thumb.src}
                          srcSet={thumb.srcSet}
                          sizes={thumb.sizes}
                          width={thumb.width}
                          height={thumb.height}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <span className="media-lightbox__footer-note">Double-click the image to inspect details</span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div className={rootClass} onClick={swallowClick}>
        <div className="media-carousel__grid" aria-label={altPrefix}>
          {(n <= visibleSlots
            ? list
            : Array.from({ length: visibleSlots }, (_, offset) => {
                const idx = (windowStart + offset) % n
                return list[idx]
              })
          ).map((u, idxInWindow) => {
            const idx = n <= visibleSlots ? idxInWindow : (windowStart + idxInWindow) % n
            const thumb = imageSources(u, { role: 'thumb', sizes: thumbSizes })
            return (
              <button
                key={u + idx}
                type="button"
                className="media-carousel__thumb"
                onClick={(e) => openAt(e, idx)}
                aria-label={`${altPrefix} — image ${idx + 1} of ${n}`}
              >
                <img
                  src={thumb.src}
                  srcSet={thumb.srcSet}
                  sizes={thumb.sizes}
                  width={thumb.width}
                  height={thumb.height}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
                <span className="media-carousel__thumb-icon">⤢</span>
              </button>
            )
          })}
        </div>
        {n > visibleSlots && (
          <>
            <button
              type="button"
              className="media-carousel__vnav media-carousel__vnav--up"
              aria-label="Previous images"
              onClick={(e) => {
                swallowClick(e)
                setWindowStart((v) => (v - 1 + n) % n)
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="media-carousel__vnav media-carousel__vnav--down"
              aria-label="Next images"
              onClick={(e) => {
                swallowClick(e)
                setWindowStart((v) => (v + 1) % n)
              }}
            >
              ↓
            </button>
          </>
        )}
      </div>
      {expanded && typeof document !== 'undefined' ? createPortal(lightbox, document.body) : null}
    </>
  )
}

export const ImageCarousel = memo(ImageCarouselBase)
