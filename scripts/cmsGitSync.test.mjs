import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { contentPath, mutationPaths, gitSync } from './cmsGitSync.mjs'

const exec = promisify(execFile)
test('CMS paths reject traversal and unrelated files', () => {
  for (const p of ['../secret', 'src/content/cms/../../../package.json', 'public/uploads/../admin/index.html', '/tmp/file', 'package.json']) {
    assert.equal(contentPath(p), false)
    assert.throws(() => mutationPaths({ action: 'deleteFile', params: { path: p } }))
  }
  assert.deepEqual(mutationPaths({ action: 'persistEntry', params: { entry: { path: 'src/content/cms/profile.json' }, assets: [] } }), ['src/content/cms/profile.json'])
  assert.equal(mutationPaths({ action: 'info' }), null)
})

test('save pushes only its files, retries failed pushes, and rejects remote conflicts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'portfolio-cms-'))
  const remote = path.join(root, 'remote.git')
  const repo = path.join(root, 'repo')
  const other = path.join(root, 'other')
  const git = async (cwd, ...args) => (await exec('git', args, { cwd })).stdout.trim()
  await git(root, 'init', '--bare', '--initial-branch=main', remote)
  await git(root, 'clone', remote, repo)
  await git(repo, 'config', 'user.name', 'CMS Test')
  await git(repo, 'config', 'user.email', 'cms-test@example.test')
  const file = 'src/content/cms/profile.json'
  await mkdir(path.join(repo, 'src/content/cms'), { recursive: true })
  await writeFile(path.join(repo, file), '{}\n')
  await writeFile(path.join(repo, 'unrelated.txt'), 'original\n')
  await git(repo, 'add', '.')
  await git(repo, 'commit', '-m', 'Initial fixture')
  await git(repo, 'push', '-u', 'origin', 'main')
  const sync = gitSync(repo)
  await sync.prepare()
  await writeFile(path.join(repo, file), '{"name":"Updated"}\n')
  await writeFile(path.join(repo, 'unrelated.txt'), 'local work\n')
  const head = await sync.publish([file])
  assert.equal(await git(root, '--git-dir', remote, 'rev-parse', 'main'), head)
  assert.equal(await git(repo, 'show', 'HEAD:unrelated.txt'), 'original')
  assert.equal(await readFile(path.join(repo, 'unrelated.txt'), 'utf8'), 'local work\n')
  await git(repo, 'add', 'unrelated.txt')
  await assert.rejects(sync.prepare(), /staged/)
  await git(repo, 'restore', '--staged', 'unrelated.txt')

  await writeFile(path.join(repo, file), '{"name":"Retry"}\n')
  await git(repo, 'remote', 'set-url', '--push', 'origin', path.join(root, 'unavailable.git'))
  await assert.rejects(sync.publish([file]))
  const pending = await git(repo, 'rev-parse', 'HEAD')
  await git(repo, 'remote', 'set-url', '--push', 'origin', remote)
  assert.equal(await sync.publish([file]), pending)
  assert.equal(await git(root, '--git-dir', remote, 'rev-parse', 'main'), pending)

  await git(root, 'clone', remote, other)
  await git(other, 'config', 'user.name', 'CMS Test')
  await git(other, 'config', 'user.email', 'cms-test@example.test')
  await writeFile(path.join(other, file), '{"name":"Remote edit"}\n')
  await git(other, 'add', file)
  await git(other, 'commit', '-m', 'Remote update')
  await git(other, 'push')
  await assert.rejects(sync.prepare(), /newer changes/)
  assert.equal(await readFile(path.join(repo, file), 'utf8'), '{"name":"Retry"}\n')
})
