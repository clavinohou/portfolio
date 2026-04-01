import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const siteJsonPath = path.join(__dirname, '..', 'src', 'content', 'cms', 'site.json')

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function main() {
  if (!fs.existsSync(siteJsonPath)) {
    console.warn('[updateResumeMeta] site.json not found, skipping.')
    return
  }

  let raw
  try {
    raw = fs.readFileSync(siteJsonPath, 'utf8')
  } catch (err) {
    console.warn('[updateResumeMeta] Failed to read site.json, skipping.', err)
    return
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch (err) {
    console.warn('[updateResumeMeta] Invalid JSON in site.json, skipping.', err)
    return
  }

  const resume = data.resume || {}
  const currentUrl = (resume.downloadUrl || '').trim()

  if (!currentUrl) {
    // Nothing to do if there is no resume URL configured
    return
  }

  // Try to resolve the resume file on disk to read its modified time.
  // This assumes files under /uploads live in public/uploads (Decap default).
  let pdfPath = null
  if (!/^https?:\/\//i.test(currentUrl)) {
    const withoutLeadingSlash = currentUrl.replace(/^\/+/, '')
    pdfPath = path.join(__dirname, '..', 'public', withoutLeadingSlash)
  }

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.warn(
      `[updateResumeMeta] Resume file not found at resolved path: ${pdfPath || '(none)'} — leaving lastUpdated unchanged.`,
    )
    return
  }

  let stats
  try {
    stats = fs.statSync(pdfPath)
  } catch (err) {
    console.warn(
      `[updateResumeMeta] Failed to stat resume file at ${pdfPath} — leaving lastUpdated unchanged.`,
      err,
    )
    return
  }

  const fileDate = formatDateYYYYMMDD(new Date(stats.mtime))

  // Only update lastUpdated if it differs from the resume PDF's modified date.
  if (resume.lastUpdated === fileDate) {
    return
  }

  resume.lastUpdated = fileDate
  // Keep this around for potential future use, but don't rely on it for detection.
  resume.internalPrevUrl = currentUrl
  data.resume = resume

  try {
    fs.writeFileSync(siteJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(
      `[updateResumeMeta] Updated resume lastUpdated=${fileDate} based on PDF mtime at ${pdfPath}`,
    )
  } catch (err) {
    console.warn('[updateResumeMeta] Failed to write updated site.json.', err)
  }
}

main()

