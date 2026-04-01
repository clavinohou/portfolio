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
  const prevUrl = (resume.internalPrevUrl || '').trim()

  if (!currentUrl) {
    // Nothing to do if there is no resume URL configured
    return
  }

  const today = formatDateYYYYMMDD(new Date())

  // If the URL changed since last build, bump the lastUpdated field automatically.
  if (currentUrl !== prevUrl) {
    resume.lastUpdated = today
    resume.internalPrevUrl = currentUrl
    data.resume = resume

    try {
      fs.writeFileSync(siteJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
      console.log(
        `[updateResumeMeta] Resume URL changed. Set lastUpdated=${today} and internalPrevUrl=${currentUrl}`,
      )
    } catch (err) {
      console.warn('[updateResumeMeta] Failed to write updated site.json.', err)
    }
  }
}

main()

