import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveUrl, resolvePcbViewer } from '../src/lib/pcbViewer.js'

const embed = 'https://personal-viewer.365.altium.com/client/index.html?source=43813802-47E4-4E9F-A52C-EAED1BDB57AB&activeView=SCH'

test('existing projects and malformed optional data do not create a viewer', () => {
  for (const input of [undefined, null, '', {}, { embedUrl: 'not a URL' }, { archiveUrl: 'javascript:alert(1)' }]) {
    assert.equal(resolvePcbViewer(input), null)
  }
})

test('persistent Altium embeds preserve the source and use the chosen view', () => {
  const viewer = resolvePcbViewer({ embedUrl: embed, defaultView: 'PCB' })
  const url = new URL(viewer.src)
  assert.equal(url.searchParams.get('feature'), 'embed')
  assert.equal(url.searchParams.get('activeView'), 'PCB')
  assert.equal(url.searchParams.get('source'), '43813802-47E4-4E9F-A52C-EAED1BDB57AB')
  assert.equal(viewer.externalUrl, viewer.src)
})

test('archives use an isolated viewer document with safely encoded parameters', () => {
  for (const source of ['/uploads/My PCB.zip', 'https://example.com/board.zip?revision=2&download=1']) {
    const viewer = resolvePcbViewer({ archiveUrl: source })
    const url = new URL(viewer.src, 'https://portfolio.example')
    assert.equal(url.pathname, '/viewers/altium.html')
    assert.equal(url.searchParams.get('source'), archiveUrl(source))
    assert.equal(url.searchParams.get('view'), '3D')
  }
})

test('only public HTTPS archives and the official persistent embed endpoint are accepted', () => {
  for (const source of ['http://example.com/board.zip', 'https://user:password@example.com/board.zip', '//example.com/board.zip', '/uploads/../private.zip', '/uploads/board.html']) {
    assert.equal(archiveUrl(source), null)
  }
  for (const url of [embed.replace('personal-viewer.365.altium.com', 'personal-viewer.365.altium.com.evil.test'), embed.replace('/client/index.html', '/other'), embed.replace('source=', 'missing=')]) {
    assert.equal(resolvePcbViewer({ embedUrl: url }), null)
  }
})

test('a valid embed takes precedence; a bad embed falls back to a valid archive', () => {
  const archive = 'https://example.com/board.zip'
  assert.equal(new URL(resolvePcbViewer({ embedUrl: embed, archiveUrl: archive }).src).hostname, 'personal-viewer.365.altium.com')
  assert.match(resolvePcbViewer({ embedUrl: 'broken', archiveUrl: archive, defaultView: 'invalid' }).src, /view=3D/)
})
