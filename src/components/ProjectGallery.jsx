import { useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { imageSources } from '../utils/imageSources'
import './ProjectGallery.css'

const PREVIEW_SIZES = '(max-width: 860px) calc(100vw - 100px), 460px'

function Thumbnail({ item }) {
  return <img {...imageSources(item.url, { role: 'thumb', sizes: '90px' })} alt="" decoding="async" draggable={false} />
}

export function ProjectGallery({ images, altPrefix, onOpenImage, visibleSlots }) {
  const groupId = useId()
  const reducedMotion = useReducedMotion()
  const [selected, setSelected] = useState(0)
  const items = useMemo(() => images.map((url, index) => ({ id: `photo-${index}`, url, index })), [images])
  const current = items[selected] ?? items[0]
  const slotCount = Math.min(4, Math.max(2, Math.floor(visibleSlots || 4)), items.length)
  const windowStart = items.length <= slotCount ? 0 : selected - Math.floor(slotCount / 2)
  const thumbnails = Array.from({ length: slotCount }, (_, offset) => {
    const index = (windowStart + offset + items.length) % items.length
    return { item: items[index], index }
  })
  const transition = reducedMotion
    ? { duration: 0 }
    : { layout: { type: 'spring', duration: 0.65, bounce: 0.08 }, opacity: { duration: 0.16 } }

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
  const step = (direction) => setSelected((value) => (value + direction + items.length) % items.length)
  const label = (item) => `photo ${item.index + 1}`

  return (
    <LayoutGroup id={groupId}>
      <div className="project-gallery" role="region" aria-label={`${altPrefix} media gallery`}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          event.stopPropagation()
          step(event.key === 'ArrowRight' ? 1 : -1)
        }}>
        <div className="project-gallery-stage">
          <AnimatePresence initial={false}>
            <motion.div key={current.id} layoutId={reducedMotion ? undefined : current.id}
              className="project-gallery-media" data-media-id={current.id}
              style={{ borderRadius: 10 }} transition={transition} exit={{ opacity: 0 }}>
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
            {thumbnails.map(({ item, index }) => (
              <button key={item.id} type="button" data-media-index={index}
                className={`project-gallery-thumbnail${selected === index ? ' is-current' : ''}`}
                aria-label={`Show ${label(item)}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
                {selected === index ? (
                  <div className="project-gallery-current-thumb"><Thumbnail item={item} /><span className="project-gallery-viewing">VIEWING</span></div>
                ) : (
                  <motion.div layoutId={reducedMotion ? undefined : item.id} className="project-gallery-thumbnail-media"
                    style={{ borderRadius: 7 }} transition={transition}>
                    <Thumbnail item={item} />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
          <button type="button" className="project-gallery-arrow" aria-label="Next media" disabled={items.length < 2} onClick={() => step(1)}>→</button>
        </div>
      </div>
    </LayoutGroup>
  )
}
