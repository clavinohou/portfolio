import test from 'node:test'
import assert from 'node:assert/strict'
import { SIGNALS, signalScreenY, triggerScreenY, triggerLevelAtY, triggerForSignal, triggerCaptureTime, capturePhase, presentationPhase, advanceAcquisition, TRIGGER_RECORD_INTERVAL } from '../src/components/scopeSignals.mjs'
import { tracePath } from '../src/components/crtSurface.mjs'

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`)
const transform = { hScale: 1.15, hOff: 0, vGain: 1.175, vOff: -12 }

test('trigger level reaches the entire plotting area and maps pointer positions back exactly', () => {
  for (const y of [0, 5.1, 25, 50, 70.9, 100]) close(triggerScreenY(triggerLevelAtY(y)), y)
  assert.equal(triggerLevelAtY(-10), 1)
  assert.equal(triggerLevelAtY(110), 0)
})

test('CH2 triggers across its whole vertical edge at every tested gain and offset', () => {
  for (const vGain of [0.35, 1.175, 2]) for (const vOff of [-20, -12, 0, 12, 20]) {
    const view = { ...transform, vGain, vOff }
    for (let raw = 22; raw <= 78; raw += 0.5) {
      const y = signalScreenY(raw, view)
      assert.equal(triggerForSignal(1, view, y).locked, true, `gain ${vGain}, offset ${vOff}, level ${raw}`)
      close(triggerForSignal(1, view, y).crossing, 27.5)
    }
    for (const raw of [21, 79]) assert.equal(triggerForSignal(1, view, signalScreenY(raw, view)).locked, false)
  }
})

test('CH2 displayed plateaus use the same coordinates as its trigger boundaries', () => {
  const slot = { x: 16, y: 109, width: 746, height: 273 }
  const path = tracePath({ width: 778, height: 480, slot, transform, phase: 82.5, shape: 1, pose: { x: 0, y: 0 } })
  const ends = [...path.matchAll(/Q([^Q]+)/g)].map(m => m[1].match(/-?\d+(?:\.\d+)?/g).map(Number).at(-1))
  close(Math.min(...ends), slot.y + signalScreenY(SIGNALS[1].min, transform) / 100 * slot.height, 0.001)
  close(Math.max(...ends), slot.y + signalScreenY(SIGNALS[1].max, transform) / 100 * slot.height, 0.001)
})

test('each source repeats at its rising crossing while other signal phases advance at shared capture times', () => {
  for (const source of [0, 1, 2]) {
    const signal = SIGNALS[source]
    const trigger = triggerForSignal(source, { vGain: 1, vOff: 0 }, 50)
    const settings = { ...trigger, hScale: 1, locked: true }
    const state = { time: 0, capture: 0, remainder: 0 }
    advanceAcquisition(state, 0, settings)
    const times = [state.capture]
    for (let i = 0; i < 30; i++) times.push(advanceAcquisition(state, TRIGGER_RECORD_INTERVAL, settings))
    for (let i = 1; i < times.length; i++) close(times[i] - times[i - 1], signal.period)
    const sourcePhases = times.map(t => capturePhase(t, signal.period))
    assert.equal(new Set(sourcePhases).size, 1, `Source ${source} remains stable`)
    for (let other = 0; other < SIGNALS.length; other++) {
      if (other === source) continue
      assert.ok(new Set(times.map(t => capturePhase(t, SIGNALS[other].period))).size > 1, `Source ${source} must not freeze signal ${other}`)
    }
  }
})

test('harmonically related signals can also remain stable under one trigger', () => {
  for (const period of [12, 24]) {
    const phases = Array.from({ length: 20 }, (_, n) => capturePhase(12 + n * 24, period))
    assert.equal(new Set(phases).size, 1)
  }
  const halfFrequency = Array.from({ length: 20 }, (_, n) => capturePhase(12 + n * 24, 48))
  assert.equal(new Set(halfFrequency).size, 2)
})

test('all channels are samples of the same acquisition rather than independent stopped clocks', () => {
  for (const time of [-143.5, 12, 36, 60, 6000, 100000.123]) for (const signal of SIGNALS) {
    close(signal.sample(110 - capturePhase(time, signal.period)), signal.sample(time), 1e-7)
  }
})

test('capture pacing is independent of browser frame rate', () => {
  const settings = { locked: true, crossing: 12, period: 24, hScale: 1 }
  const end = (fps) => {
    const state = { time: 0, capture: 0, remainder: 0 }
    for (let i = 0; i < fps * 12; i++) advanceAcquisition(state, 1 / fps, settings)
    return state.capture
  }
  close(end(30), end(60))
  close(end(60), end(144))
  close(end(60), 60)
})

test('triggered playback drifts slowly and continuously across capture boundaries', () => {
  const fps = 60
  for (let source = 0; source < SIGNALS.length; source++) {
    const state = { time: 0, capture: 0, remainder: 0 }
    const trigger = triggerForSignal(source, { vGain: 1, vOff: 0 }, 50)
    const settings = { ...trigger, locked: true, hScale: 1 }
    advanceAcquisition(state, 0, settings)
    let previous = SIGNALS.map((s, i) => presentationPhase(state, s.period, i === source))
    const positions = SIGNALS.map(() => new Set())
    for (let frame = 0; frame < fps * 9; frame++) {
      advanceAcquisition(state, 1 / fps, settings)
      for (let i = 0; i < SIGNALS.length; i++) {
        const p = SIGNALS[i].period
        const phase = presentationPhase(state, p, i === source)
        const rawDistance = Math.abs(phase - previous[i])
        const distance = Math.min(rawDistance, p - rawDistance)
        if (i === source) close(distance, 0)
        else {
          let shift = settings.period % p
          if (shift > p / 2) shift -= p
          assert.ok(distance <= Math.abs(shift) / TRIGGER_RECORD_INTERVAL / fps + 1e-7, 'No phase jump between captures')
          assert.ok(distance / p <= 1 / fps / 8 + 1e-7, 'At most one full drift cycle in eight seconds')
        }
        previous[i] = phase
        positions[i].add(phase)
      }
    }
    for (let i = 0; i < SIGNALS.length; i++) assert.equal(positions[i].size > 1, i !== source)
  }
})

test('interpolated playback preserves stable harmonics and exact acquired phases at record boundaries', () => {
  const state = { locked: true, period: 24, capture: 12, remainder: 0 }
  for (const p of [12, 24, 55, 200]) {
    close(presentationPhase(state, p, false), capturePhase(state.capture, p))
    state.remainder = TRIGGER_RECORD_INTERVAL
    close(presentationPhase(state, p, false), capturePhase(state.capture + state.period, p))
    state.remainder = 0
  }
  for (const p of [12, 24]) for (const fraction of [0, .1, .5, .9]) {
    state.remainder = fraction * TRIGGER_RECORD_INTERVAL
    close(presentationPhase(state, p, false), capturePhase(12, p))
  }
})

test('AUTO keeps continuous shared time without resetting at any signal period', () => {
  const state = { time: 22, capture: 22, remainder: 0 }
  const settings = { locked: false, crossing: 12, period: 24, hScale: 1 }
  let previous = state.capture
  for (let i = 0; i < 300; i++) {
    const capture = advanceAcquisition(state, 1 / 60, settings)
    close(capture - previous, 28 / 60)
    previous = capture
  }
  close(state.time, 162)
})

test('trigger records land on the same crossing even when the timeline or source changes', () => {
  for (const period of [24, 55, 200]) for (const time of [-1000, 0, 27.5, 150, 100000]) {
    const capture = triggerCaptureTime(time, 12.345, period)
    assert.ok(capture <= time + 1e-8)
    assert.ok(capture + period > time - 1e-8)
    close((capture - 12.345) / period, Math.round((capture - 12.345) / period))
  }
})
