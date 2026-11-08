export const SQUARE_PERIOD = 55
export const SQUARE_TOP = 22
export const SQUARE_BOTTOM = 78
const COMPLEX_PERIOD = 200
const COMPLEX_COMPONENTS = [
  { harmonic: 2, amplitude: 15, phase: 0 },
  { harmonic: 5, amplitude: 7, phase: 0.85 },
  { harmonic: 11, amplitude: 3.5, phase: -0.4 },
]

export function sineWaveY(x) {
  return 50 + 23 * Math.sin(x / 24 * 2 * Math.PI)
}

function rawComplexWaveY(x) {
  return COMPLEX_COMPONENTS.reduce((value, component) => value + component.amplitude *
    Math.sin(x / COMPLEX_PERIOD * 2 * Math.PI * component.harmonic + component.phase), 0)
}

let complexPeak = 1
for (let x = 0; x <= COMPLEX_PERIOD; x += 0.05) complexPeak = Math.max(complexPeak, Math.abs(rawComplexWaveY(x)))
const COMPLEX_GAIN = 22 / complexPeak

export function complexWaveY(x) {
  return 50 + rawComplexWaveY(x) * COMPLEX_GAIN
}

export function squareWaveY(x) {
  const half = Math.floor(x / (SQUARE_PERIOD / 2))
  return ((half % 2) + 2) % 2 === 0 ? SQUARE_BOTTOM : SQUARE_TOP
}

function sampledLimits(sample, period) {
  let min = Infinity
  let max = -Infinity
  for (let x = 0; x <= period; x += 0.02) {
    const y = sample(x)
    min = Math.min(min, y)
    max = Math.max(max, y)
  }
  return { min, max }
}

// Trigger detection and rendering read the same waveform definitions.
export const SIGNALS = [
  { period: 24, min: 27, max: 73, sample: sineWaveY },
  { period: SQUARE_PERIOD, min: SQUARE_TOP, max: SQUARE_BOTTOM, sample: squareWaveY },
  { period: COMPLEX_PERIOD, ...sampledLimits(complexWaveY, COMPLEX_PERIOD), sample: complexWaveY },
]

export function signalScreenY(y, { vGain, vOff }) {
  return (y - 50) * vGain + 50 + vOff
}

export function triggerScreenY(level) {
  return (1 - level) * 100
}

export function triggerLevelAtY(y) {
  return Math.max(0, Math.min(1, 1 - y / 100))
}

export function risingCrossingX(shapeIndex, rawLevel) {
  const signal = SIGNALS[shapeIndex]
  const level = Math.max(signal.min, Math.min(signal.max, rawLevel))
  if (shapeIndex === 0) return (Math.PI - Math.asin(Math.max(-1, Math.min(1, (level - 50) / 23)))) / (2 * Math.PI) * signal.period
  if (shapeIndex === 1) return signal.period / 2

  let previousX = 0
  let previousY = signal.sample(0)
  let nearestX = 0
  let nearestDistance = Math.abs(previousY - level)
  for (let x = 0.05; x <= signal.period; x += 0.05) {
    const y = signal.sample(x)
    const distance = Math.abs(y - level)
    if (distance < nearestDistance) { nearestDistance = distance; nearestX = x }
    if (previousY >= level && y <= level) return previousX + (previousY - level) / (previousY - y || 1) * (x - previousX)
    previousX = x
    previousY = y
  }
  return nearestX
}

export function triggerForSignal(shapeIndex, transform, screenY) {
  const signal = SIGNALS[shapeIndex]
  const level = 50 + (screenY - transform.vOff - 50) / transform.vGain
  const tolerance = 0.35
  return {
    locked: level >= signal.min - tolerance && level <= signal.max + tolerance,
    crossing: risingCrossingX(shapeIndex, level),
    period: signal.period,
  }
}

export function triggerCaptureTime(time, crossing, period) {
  return crossing + Math.floor((time - crossing) / period + 1e-10) * period
}

export function capturePhase(time, period) {
  // Reducing each periodic signal separately is safe: the original acquisition
  // time is still shared. Never reset the clock to the selected channel's period.
  const position = ((time % period) + period) % period
  return 110 - Math.round(position * 1e9) / 1e9
}

// Actual records still advance by whole source cycles. The display slowly
// interpolates the phase between those records while keeping the source fixed.
export const TRIGGER_RECORD_INTERVAL = 4

export function presentationPhase(state, period, isTriggerSource) {
  if (!state.locked || isTriggerSource) return capturePhase(state.capture, period)
  let shift = state.period % period
  if (shift > period / 2) shift -= period
  const fraction = Math.max(0, Math.min(1, state.remainder / TRIGGER_RECORD_INTERVAL))
  return capturePhase(state.capture + shift * fraction, period)
}

export function advanceAcquisition(state, elapsed, { locked, crossing, period, hScale }) {
  state.locked = locked
  state.period = period
  if (locked) {
    state.remainder += elapsed
    const records = Math.floor((state.remainder + 1e-10) / TRIGGER_RECORD_INTERVAL)
    state.remainder -= records * TRIGGER_RECORD_INTERVAL
    state.time += records * period
    state.capture = triggerCaptureTime(state.time, crossing, period)
  } else {
    state.remainder = 0
    state.time += elapsed * 28 / Math.max(0.3, hScale)
    state.capture = state.time
  }
  return state.capture
}
