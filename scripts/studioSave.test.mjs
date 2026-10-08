import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

// Exercise the registered hook, including its return value: Decap treats that
// value as the complete set of fields to serialize, not as an editor entry.
const element = {
  addEventListener() {}, setAttribute() {}, querySelector() { return null },
  querySelectorAll() { return [] }, classList: { toggle() {}, contains() { return false } },
}
let preSave
vm.runInNewContext(await fs.readFile(new URL('../public/admin/studio.js', import.meta.url), 'utf8'), {
  document: { getElementById() { return element }, querySelectorAll() { return [] }, body: element },
  window: { addEventListener() {}, CMS: { registerEventListener(event) { preSave = event.handler } } },
  MutationObserver: class { observe() {} },
})
class Fields {
  constructor(data) { this.data = data }
  get(key) { return this.data[key] }
  has(key) { return Object.hasOwn(this.data, key) }
  set(key, value) { return new Fields({ ...this.data, [key]: value }) }
}
const save = fields => preSave({ entry: new Fields({ data: fields, mediaFiles: ['editor-only'], slug: 'resume' }) })

test('a new résumé saves PDF fields at the root, without editor metadata', () => {
  const saved = save(new Fields({ downloadUrl: '/uploads/new.pdf', internalPrevUrl: '/uploads/old.pdf', highlights: ['One'] }))
  assert.equal(saved.get('downloadUrl'), '/uploads/new.pdf')
  assert.equal(saved.get('internalPrevUrl'), '/uploads/new.pdf')
  assert.match(saved.get('lastUpdated'), /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(saved.get('highlights'), ['One'])
  assert.equal(saved.has('data'), false)
  assert.equal(saved.has('mediaFiles'), false)
})
test('unchanged résumé and other collections retain their fields', () => {
  const resume = new Fields({ downloadUrl: '/uploads/new.pdf', internalPrevUrl: '/uploads/new.pdf', lastUpdated: '2026-01-01' })
  assert.equal(save(resume), resume)
  const project = new Fields({ title: 'Project', description: 'Build notes' })
  assert.equal(save(project), project)
})
