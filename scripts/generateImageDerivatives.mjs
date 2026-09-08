/**
 * Generates resized WebP derivatives for everything in `public/uploads/` and
 * writes `src/content/imageManifest.json` describing them.
 *
 * The CMS stores camera-original photos (many are 4032x3024, one is 5712x4284)
 * but the UI paints them into 160px thumbnails. Decoding a 12MP JPEG costs
 * ~48MB of bitmap memory and enough raster work to visibly stall the projector
 * animation, so the app serves these derivatives instead and keeps the
 * originals purely as CMS source material.
 *
 * Safe to re-run: unchanged sources are skipped, and any failure degrades to a
 * warning so a bad image can never break the deploy.
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const UPLOADS_DIR = path.join(ROOT, 'public', 'uploads')
// Deliberately outside `public/uploads` (Decap's `media_folder`) so generated
// files never show up in the CMS media picker.
const DERIVED_DIR = path.join(ROOT, 'public', 'media', 'derived')
const MANIFEST_PATH = path.join(ROOT, 'src', 'content', 'imageManifest.json')

/** Public-URL prefixes, not filesystem paths. */
const PUBLIC_UPLOADS = '/uploads'
const PUBLIC_DERIVED = '/media/derived'

/**
 * 320/640 cover the 140-160px card thumbnails at 1x-3x DPR; 960/1600 cover the
 * lightbox, whose panel maxes out at 960px wide and can be zoomed 1.5x.
 */
const TARGET_WIDTHS = [320, 640, 960, 1600]
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const WEBP_QUALITY = 80

const log = (...args) => console.log('[images]', ...args)
const warn = (...args) => console.warn('[images]', ...args)

/** Strip the extension and normalize to the slug Decap already uses for uploads. */
function baseName(file) {
  return file.slice(0, file.length - path.extname(file).length)
}

async function isStale(sourcePath, outputPath) {
  if (!existsSync(outputPath)) return true
  try {
    const [src, out] = await Promise.all([fs.stat(sourcePath), fs.stat(outputPath)])
    return src.mtimeMs > out.mtimeMs
  } catch {
    return true
  }
}

async function main() {
  if (!existsSync(UPLOADS_DIR)) {
    warn('public/uploads not found, skipping.')
    return
  }

  let sharp
  try {
    ;({ default: sharp } = await import('sharp'))
  } catch (err) {
    // A committed manifest from a previous run keeps the site working, so this
    // is recoverable rather than fatal.
    warn('sharp unavailable, keeping existing manifest.', err?.message ?? err)
    return
  }

  const entries = (await fs.readdir(UPLOADS_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort()

  await fs.mkdir(DERIVED_DIR, { recursive: true })

  const manifest = {}
  let generated = 0
  let skipped = 0

  for (const file of entries) {
    const sourcePath = path.join(UPLOADS_DIR, file)
    const slug = baseName(file)

    let meta
    try {
      meta = await sharp(sourcePath).metadata()
    } catch (err) {
      warn(`could not read ${file}, leaving it as-is.`, err?.message ?? err)
      continue
    }

    // EXIF orientation 5-8 swap the axes, so trust the display dimensions.
    const rotated = typeof meta.orientation === 'number' && meta.orientation >= 5
    const width = rotated ? meta.height : meta.width
    const height = rotated ? meta.width : meta.height
    if (!width || !height) {
      warn(`no dimensions for ${file}, leaving it as-is.`)
      continue
    }

    // Only downscale. If the source is already smaller than a target we'd just
    // be re-encoding it larger, so cap the set at the source width.
    const widths = TARGET_WIDTHS.filter((w) => w < width)
    if (widths.length === 0) {
      skipped += 1
      continue
    }

    const written = []
    for (const w of widths) {
      const outName = `${slug}-${w}.webp`
      const outPath = path.join(DERIVED_DIR, outName)
      if (await isStale(sourcePath, outPath)) {
        try {
          await sharp(sourcePath)
            .rotate() // bake in EXIF orientation; the resized copy has no EXIF
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 4 })
            .toFile(outPath)
          generated += 1
        } catch (err) {
          warn(`failed to resize ${file} to ${w}w, skipping that size.`, err?.message ?? err)
          continue
        }
      }
      written.push(w)
    }

    if (written.length === 0) continue

    manifest[`${PUBLIC_UPLOADS}/${file}`] = {
      w: width,
      h: height,
      base: `${PUBLIC_DERIVED}/${slug}`,
      widths: written,
    }
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8')

  log(
    `${Object.keys(sorted).length} images in manifest, ${generated} derivative(s) written, ${skipped} already small enough.`,
  )
}

main().catch((err) => {
  warn('generation failed, keeping existing manifest.', err?.message ?? err)
})
