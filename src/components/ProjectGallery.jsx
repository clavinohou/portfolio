import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { imageSources } from '../utils/imageSources'
import './ProjectGallery.css'

const PREVIEW_SIZES = '(max-width: 860px) calc(100vw - 100px), 460px'
const SLIDE_VARIANTS = {
  enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%' }),
  active: { x: '0%', pointerEvents: 'auto' },
  exit: (direction) => ({ x: direction > 0 ? '-100%' : '100%', pointerEvents: 'none' }),
}

function Thumbnail({ item }) {
  return <img {...imageSources(item.url, { role: 'thumb', sizes: '90px' })} alt="" decoding="async" draggable={false} />
}

export function ProjectGallery({ images, altPrefix, onOpenImage, visibleSlots }) {
  const reducedMotion = useReducedMotion()
  const [{ selected, direction, firstThumbnail }, setSelection] = useState({
    selected: 0,
    direction: 1,
    firstThumbnail: 0,
  })
  const items = useMemo(() => images.map((url, index) => ({ id: `photo-${index}`, url, index })), [images])
  const current = items[selected] ?? items[0]
  const slotCount = Math.min(4, Math.max(2, Math.floor(visibleSlots || 4)), items.length)
  const thumbnails = items.slice(firstThumbnail, firstThumbnail + slotCount)

  useEffect(() => {
    // Warm adjacent fitted previews, without downloading camera originals.
    for (const offset of [-1, 1]) {
      const item = items[(selected + offset + items.length) % items.length]
      if (!item) continue
      const source = imageSources(item.url, { role: 'full', sizes: PREVIEW_SIZES })
      const image = new Image()
      image.decoding = 'async'
      image.sizes = source.sizes ?? PREVIEW_SIZES
      if (source.srcSet) image.srcset = source.srcSet
      image.src = source.src
    }
  }, [selected, items])

  if (!current) return null
  const changePhoto = (getIndex, travelDirection) => {
    setSelection((previous) => {
      const next = getIndex(previous.selected)
      if (next === previous.selected) return previous
      return {
        selected: next,
        direction: travelDirection ?? Math.sign(next - previous.selected),
        // Keep the current thumbnail window until the selection moves outside it.
        firstThumbnail: Math.max(next - slotCount + 1, Math.min(previous.firstThumbnail, next)),
      }
    })
  }
  const step = (offset) => changePhoto((index) => (index + offset + items.length) % items.length, offset)
  const label = (item) => `photo ${item.index + 1}`

  return (
    <div className="project-gallery" role="region" aria-label={`${altPrefix} media gallery`}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        event.stopPropagation()
        step(event.key === 'ArrowRight' ? 1 : -1)
      }}>
      <div className="project-gallery-stage">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div key={current.id} custom={direction} variants={SLIDE_VARIANTS}
            className="project-gallery-media" data-media-id={current.id}
            initial={reducedMotion ? false : 'enter'} animate="active" exit={reducedMotion ? undefined : 'exit'}
            transition={{ duration: reducedMotion ? 0 : 0.32, ease: 'easeInOut' }}>
            <button type="button" className="project-gallery-open" aria-label={`Open ${label(current)} full size`}
              onClick={(event) => onOpenImage(event, current.index)}>
              <img {...imageSources(current.url, { role: 'full', sizes: PREVIEW_SIZES })}
                alt={`${altPrefix}, ${label(current)}`} decoding="async" draggable={false} />
              <span className="project-gallery-enlarge" aria-hidden="true">⤢</span>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="project-gallery-caption mono" aria-live="polite" aria-atomic="true">
        <span>PROJECT MEDIA</span>
        <span>{String(selected + 1).padStart(2, '0')} <span className="project-gallery-count-separator">/</span> {String(items.length).padStart(2, '0')}</span>
      </div>

      <div className="project-gallery-carousel" style={{ '--gallery-slots': slotCount }}>
        <button type="button" className="project-gallery-arrow" aria-label="Previous media" disabled={items.length < 2} onClick={() => step(-1)}>←</button>
        <div className="project-gallery-rail" aria-label="Choose project media">
          {thumbnails.map((item) => (
            <button key={item.id} type="button" data-media-index={item.index}
              className={`project-gallery-thumbnail${selected === item.index ? ' is-current' : ''}`}
              aria-label={`Show ${label(item)}`} aria-pressed={selected === item.index} onClick={() => changePhoto(() => item.index)}>
              <div className="project-gallery-thumbnail-media">
                <Thumbnail item={item} />
                {selected === item.index ? <span className="project-gallery-viewing">VIEWING</span> : null}
              </div>
            </button>
          ))}
        </div>
        <button type="button" className="project-gallery-arrow" aria-label="Next media" disabled={items.length < 2} onClick={() => step(1)}>→</button>
      </div>
    </div>
  )
}
