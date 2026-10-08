import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const exec = promisify(execFile)
export const contentPath = value => typeof value === 'string' &&
  !value.includes('\\') && !value.includes('\0') &&
  path.posix.normalize(value) === value &&
  (value.startsWith('src/content/cms/') || value.startsWith('public/uploads/'))

export function mutationPaths(body) {
  const p = body.params || {}
  let paths
  switch (body.action) {
    case 'persistEntry':
      paths = [...(p.dataFiles || [p.entry]).flatMap(e => [e?.path, ...(e?.newPath ? [e.newPath] : [])]),
        ...(p.assets || []).map(a => a.path)]
      break
    case 'persistMedia': paths = [p.asset?.path]; break
    case 'deleteFile': paths = [p.path]; break
    case 'deleteFiles': paths = p.paths; break
    default: return null
  }
  if (!Array.isArray(paths) || !paths.length || !paths.every(contentPath)) {
    throw new Error('Only portfolio content and uploads can be saved through this backend.')
  }
  return [...new Set(paths)]
}

export function gitSync(repo) {
  const git = async (...args) => (await exec('git', args, {
    cwd: repo, timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })).stdout.trim()

  return {
    async prepare() {
      if (await git('branch', '--show-current') !== 'main') throw new Error('Switch to main before saving.')
      if (await git('diff', '--cached', '--name-only')) {
        throw new Error('Other changes are staged. Commit or unstage them before saving.')
      }
      await git('fetch', 'origin', 'main')
      try { await git('merge-base', '--is-ancestor', 'origin/main', 'HEAD') }
      catch { throw new Error('GitHub has newer changes. Sync main before saving; no files were changed.') }
    },
    async publish(paths, message = 'Update portfolio content') {
      // Restrict staging to the saved entry and its media, including deletions.
      const changed = await git('status', '--porcelain', '--', ...paths)
      if (changed) {
        await git('add', '-A', '--', ...paths)
        if (await git('diff', '--cached', '--name-only')) {
          await git('commit', '-m', message)
        }
      }
      // Also retries a previous commit whose push failed, even on an unchanged save.
      await git('push', 'origin', 'HEAD:main')
      const head = await git('rev-parse', 'HEAD')
      const remote = await git('ls-remote', 'origin', 'refs/heads/main')
      if (remote.split(/\s+/)[0] !== head) throw new Error('GitHub confirmation failed. Retry saving.')
      return head
    },
  }
}
