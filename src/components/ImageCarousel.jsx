import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { publicUrl } from '../utils/publicUrl'
import './ImageCarousel.css'

export function ImageCarousel({ images, altPrefix = 'Photo', variant = 'cover' }) {
  const list = (Array.isArray(images) ? images : []).map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean)
  const [i, setI] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setI(0)
  }, [images])

  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [expanded])

  const n = list.length
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, goPrev, goNext])

  if (n === 0) return null

  const src = publicUrl(list[i])
  const rootClass = `media-carousel media-carousel--${variant}`

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
        >
          <motion.div
            className="media-lightbox__backdrop"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
          />
          <motion.div
            className="media-lightbox__panel"
            role="document"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="media-lightbox__chrome">
              <span className="media-lightbox__title">{altPrefix}</span>
              {n > 1 ? (
                <span className="media-lightbox__counter">
                  {i + 1} / {n}
                </span>
              ) : null}
              <button
                type="button"
                className="media-lightbox__close"
                aria-label="Close"
                onClick={() => setExpanded(false)}
              >
                ×
              </button>
            </div>
            <div className={`media-lightbox__stage media-lightbox__stage--${variant}`}>
              {n > 1 && (
                <>
                  <button
                    type="button"
                    className="media-lightbox__nav media-lightbox__nav--prev"
                    aria-label="Previous"
                    onClick={(e) => {
                      e.stopPropagation()
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
                      e.stopPropagation()
                      goNext(e)
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              <motion.img
                key={i}
                src={src}
                alt=""
                className="media-lightbox__img"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div className={rootClass} onClick={(e) => e.stopPropagation()}>
        <div className="media-carousel__viewport">
          <img
            src={src}
            alt={`${altPrefix} — ${i + 1} of ${n}`}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
        <button
          type="button"
          className="media-carousel__expand"
          aria-label="Open full size in a popup"
          onClick={() => setExpanded(true)}
        >
          ⤢
        </button>
        {n > 1 && (
          <>
            <button type="button" className="media-carousel__nav media-carousel__nav--prev" aria-label="Previous" onClick={goPrev}>
              ‹
            </button>
            <button type="button" className="media-carousel__nav media-carousel__nav--next" aria-label="Next" onClick={goNext}>
              ›
            </button>
            <div className="media-carousel__dots" role="tablist" aria-label="Slides">
              {list.map((_, di) => (
                <button
                  key={di}
                  type="button"
                  role="tab"
                  aria-selected={di === i}
                  className={`media-carousel__dot ${di === i ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setI(di)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {typeof document !== 'undefined' ? createPortal(lightbox, document.body) : null}
    </>
  )
}
