import test from 'node:test'
import assert from 'node:assert/strict'
import { trackEvent, createAdjustmentTracker } from '../src/lib/analytics.js'

function capture(t) {
  const original = globalThis.window
  const events = []
  globalThis.window = {
    location: { pathname: '/log/board', search: '?email=private@example.com' },
    gtag: (...args) => events.push(args),
  }
  t.after(() => { globalThis.window = original })
  return events
}

test('custom events exclude form contents, URLs, and query data', (t) => {
  const events = capture(t)
  trackEvent('contact_email_compose', {
    contact_method: 'email', name: 'Private Person', email: 'private@example.com',
    message: 'Private message', link_url: 'mailto:test?body=Private message',
  })
  assert.deepEqual(events, [['event', 'contact_email_compose', {
    page_path: '/log/board', contact_method: 'email',
  }]])
})

test('blocked or unavailable analytics never breaks site actions', (t) => {
  capture(t)
  window.gtag = undefined
  assert.doesNotThrow(() => trackEvent('resume_download'))
  window.gtag = () => { throw new Error('blocked') }
  assert.doesNotThrow(() => trackEvent('resume_download'))
  delete globalThis.window
  assert.doesNotThrow(() => trackEvent('resume_download'))
})

test('a drag batches many updates into one event and repeated release is harmless', (t) => {
  const events = capture(t)
  const tracker = createAdjustmentTracker('vertical_offset', 'ch2')
  for (let i = 0; i < 20; i++) tracker.record(0.2 + i * 0.01, 0.21 + i * 0.01, 'drag', false)
  assert.equal(events.length, 0)
  tracker.flush()
  tracker.flush()
  assert.equal(events.length, 1)
  assert.deepEqual(events[0][2], {
    page_path: '/log/board', scope_control: 'vertical_offset', scope_channel: 'ch2',
    start_value: 20, end_value: 40, input_method: 'drag',
  })
})

test('wheel bursts aggregate and returning to the original value is ignored', (t) => {
  const events = capture(t)
  const tracker = createAdjustmentTracker('seconds_per_division', 'ch1')
  tracker.record(0.5, 0.6, 'wheel')
  tracker.record(0.6, 0.7, 'wheel')
  tracker.flush()
  assert.equal(events.length, 1)
  assert.equal(events[0][2].end_value, 70)
  tracker.record(0.7, 0.8, 'drag', false)
  tracker.record(0.8, 0.7, 'drag', false)
  tracker.flush()
  assert.equal(events.length, 1)
})
