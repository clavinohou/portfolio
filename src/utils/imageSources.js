import manifest from '../content/imageManifest.json'
import { publicUrl } from './publicUrl'

/**
 * Maps a CMS image path to the resized WebP derivatives produced by
 * `scripts/generateImageDerivatives.mjs`.
 *
 * Originals are camera-resolution (up to 5712x4284) and are never served to the
 * browser — decoding one costs ~50-100MB of bitmap memory and enough raster
 * work to stall an in-flight animation. Anything missing from the manifest
 * (a fresh CMS upload, an SVG data URI, a remote URL) falls back to the plain
 * original so nothing ever renders broken.
 */

/** Widest derivative a card thumbnail will ever need (160-200px box at 3x DPR). */
const THUMB_MAX_WIDTH = 960

/** Lightbox panel is `min(96vw, 960px)` and zooms 1.5x, so 1600 is already generous. */
const FULL_MAX_WIDTH = 1600

const DEFAULT_THUMB_SIZES = '(max-width: 640px) 90vw, (max-width: 900px) 280px, 200px'
const DEFAULT_FULL_SIZES = '(max-width: 1000px) 96vw, 960px'

/** Manifest keys are base-less, root-relative paths (e.g. `/uploads/photo.jpg`). */
function manifestKey(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return ''
  const trimmed = rawPath.trim()
  if (!trimmed || /^(https?:|data:)/i.test(trimmed)) return ''
  const withoutQuery = trimmed.split(/[?#]/)[0]
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
}

/**
 * @param {string} rawPath CMS path, e.g. `/uploads/img_3909-copy.jpg`
 * @param {{ role?: 'thumb' | 'full', sizes?: string }} [options]
 * @returns {{ src: string, srcSet?: string, sizes?: string, width?: number, height?: number }}
 */
export function imageSources(rawPath, { role = 'thumb', sizes } = {}) {
  const fallback = { src: publicUrl(rawPath) }
  const entry = manifest[manifestKey(rawPath)]
  if (!entry || !Array.isArray(entry.widths) || entry.widths.length === 0) return fallback

  const isThumb = role === 'thumb'
  const cap = isThumb ? THUMB_MAX_WIDTH : FULL_MAX_WIDTH
  const widths = entry.widths.filter((w) => w <= cap)
  // Every entry has at least one derivative narrower than the source, but if
  // the cap excluded them all, keep the smallest rather than emitting nothing.
  const chosen = widths.length > 0 ? widths : [Math.min(...entry.widths)]

  const url = (w) => publicUrl(`${entry.base}-${w}.webp`)
  const widest = chosen[chosen.length - 1]

  return {
    // `src` is the fallback for browsers that ignore srcSet; keep it small so
    // it is never the expensive choice.
    src: url(chosen[0]),
    srcSet: chosen.map((w) => `${url(w)} ${w}w`).join(', '),
    sizes: sizes ?? (isThumb ? DEFAULT_THUMB_SIZES : DEFAULT_FULL_SIZES),
    width: widest,
    height: Math.round((entry.h / entry.w) * widest),
  }
}

/**
 * The exact URL the browser will pick for a thumbnail at typical viewport and
 * DPR. Used by the preloader so it warms the file that actually gets painted
 * instead of the multi-megabyte original.
 */
export function thumbPreloadUrl(rawPath) {
  const { src, srcSet, sizes } = imageSources(rawPath, { role: 'thumb' })
  return { src, srcSet, sizes }
}
