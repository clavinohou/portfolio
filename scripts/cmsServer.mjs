import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { gitSync, mutationPaths } from './cmsGitSync.mjs'

// Use the server's own Express version, without adding another dependency.
const require = createRequire(import.meta.url)
const decapRequire = createRequire(require.resolve('decap-server/package.json'))
const express = decapRequire('express')
const { registerLocalFs } = require('decap-server/dist/middlewares.js')
const repo = path.resolve(process.env.GIT_REPO_DIRECTORY || process.cwd())
const scripts = path.dirname(fileURLToPath(import.meta.url))
const sync = gitSync(repo)
const exec = promisify(execFile)
const app = express()
const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
let queue = Promise.resolve()

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && !origins.has(origin)) return res.status(403).json({ error: 'Use the local Portfolio Studio.' })
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({ limit: '50mb' }))
app.post('/api/v1', async (req, res, next) => {
  let paths
  try { paths = mutationPaths(req.body) }
  catch (error) { return res.status(422).json({ error: error.message }) }
  if (!paths) return next()

  // Serialize writes and Git operations so simultaneous saves cannot mix commits.
  const previous = queue
  let release
  queue = new Promise(resolve => { release = resolve })
  await previous
  res.once('finish', release)
  try { await sync.prepare() }
  catch (error) {
    release()
    return res.status(409).json({ error: `Save stopped before writing: ${error.message}` })
  }
  const send = res.json.bind(res)
  res.json = payload => {
    if (res.statusCode >= 400) { release(); return send(payload) }
    ;(async () => {
      try {
        // Decap starts entry renames asynchronously; wait until the destination exists.
        for (const entry of req.body.params.dataFiles || [req.body.params.entry].filter(Boolean)) {
          if (entry.newPath && entry.newPath !== entry.path) {
            let found = false
            for (let attempt = 0; attempt < 100; attempt++) {
              try { await access(path.join(repo, entry.newPath)); found = true; break }
              catch { await delay(20) }
            }
            if (!found) throw new Error('The renamed entry is not ready. Retry saving.')
          }
        }
        if (paths.some(p => p.startsWith('public/uploads/'))) {
          await exec(process.execPath, [path.join(scripts, 'generateImageDerivatives.mjs')], { cwd: repo, timeout: 120000 })
          paths.push('src/content/imageManifest.json', 'public/media/derived')
        }
        const commit = await sync.publish(paths)
        console.log(`Saved and pushed to GitHub: ${commit.slice(0, 7)}`)
        send(payload)
      } catch (error) {
        console.error(`GitHub sync failed: ${error.message}`)
        res.status(503)
        send({ error: `Saved locally, but GitHub sync failed. Retry saving to push: ${error.message}` })
      } finally { release() }
    })()
    return res
  }
  next()
})

await registerLocalFs(app, { logger: { info: console.log, error: console.error } })
app.listen(8081, '127.0.0.1', () => console.log('Portfolio Studio backend: http://localhost:8081 — automatic GitHub sync enabled'))
