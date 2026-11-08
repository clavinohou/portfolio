import test from 'node:test'
import assert from 'node:assert/strict'
import { projectSurface, surfaceDepth, surfaceLine, tracePath } from '../src/components/crtSurface.mjs'

const width = 800
const height = 500
const close = (a, b, tolerance = 0.001) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`)

test('front view leaves the calibrated graticule coordinates undistorted', () => {
  for (const [x, y] of [[0, 0], [400, 250], [132, 192], [800, 500]]) {
    assert.deepEqual(projectSurface(x, y, width, height), { x, y })
  }
  assert.equal(surfaceDepth(0, 0, width, height), 0)
  assert.ok(surfaceDepth(400, 250, width, height) > surfaceDepth(0, 250, width, height))
})

test('the quadratic grid path matches the curved surface throughout the line', () => {
  const pose = { x: -0.6, y: 0.2 }
  const path = surfaceLine(0, 144, width, 144, width, height, pose)
  const [sx, sy, cx, cy, ex, ey] = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const p = projectSurface(width * t, 144, width, height, pose)
    close((1 - t) ** 2 * sx + 2 * t * (1 - t) * cx + t * t * ex, p.x)
    close((1 - t) ** 2 * sy + 2 * t * (1 - t) * cy + t * t * ey, p.y)
  }
})

test('a beam on a grid division stays registered at every tested viewing angle', () => {
  for (const pose of [{ x: -0.6, y: 0.25 }, { x: 0, y: 0 }, { x: 0.6, y: -0.2 }]) {
    const y = 144
    const path = tracePath({ width, height, slot: { x: 0, y: 0, width, height }, transform: { hScale: 1, vGain: 1, hOff: 0, vOff: 0 }, phase: 0, shape: 0, sample: () => y / height * 100, pose })
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
    // Each cubic ends at the projected signal sample, on the same graticule.
    for (let i = 0; i <= numbers.length - 2; i += 6) {
      const index = i / 6
      const p = projectSurface(index * 2, y, width, height, pose)
      close(numbers[i], p.x)
      close(numbers[i + 1], p.y)
    }
  }
})

test('opposite viewing angles produce equal and opposite surface displacement', () => {
  for (const [x, y] of [[100, 120], [400, 250], [720, 400]]) {
    const left = projectSurface(x, y, width, height, { x: -0.6, y: 0.2 })
    const right = projectSurface(x, y, width, height, { x: 0.6, y: 0.2 })
    close(left.x + right.x, 2 * x)
    close(left.y, right.y)
  }
})

test('square-wave transitions remain exact curved segments under gain, offset and phase changes', () => {
  const path = tracePath({ width, height, slot: { x: 16, y: 90, width: 768, height: 260 }, transform: { hScale: 0.3, vGain: 2, hOff: -88, vOff: 20 }, phase: -24.3, shape: 1, pose: { x: -0.6, y: 0.2 } })
  assert.ok(path.startsWith('M'))
  assert.ok(path.includes('Q'))
  assert.ok(!/[CL]|NaN|Infinity/.test(path))
  const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
  assert.ok(values.every(Number.isFinite))
})
