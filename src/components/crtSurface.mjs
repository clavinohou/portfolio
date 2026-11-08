import { SQUARE_PERIOD, SQUARE_TOP, SQUARE_BOTTOM, signalScreenY } from './scopeSignals.mjs'

export const CRT_CORNER_X = 0.065
export const CRT_CORNER_Y = 0.08

// The convex CRT face defines the projection used by the grid and beam;
// the pose is the camera's projection of one unit of depth into panel space.
export function surfaceDepth(x, y, width, height) {
  const u = (x / width - 0.5) * 2
  const v = (y / height - 0.5) * 2
  const rise = Math.min(width, height) * 0.145
  return rise * Math.max(0, 1 - (u * u + v * v) / 2)
}

export function projectSurface(x, y, width, height, pose = { x: 0, y: 0 }) {
  const z = surfaceDepth(x, y, width, height)
  return { x: x + z * pose.x, y: y + z * pose.y }
}

const pointText = ({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`

// A straight graticule line on the paraboloid projects to an exact quadratic
// Bezier. No bitmap displacement, texture sampling, or segmented grid tiles.
export function surfaceLine(x0, y0, x1, y1, width, height, pose, move = true) {
  const start = projectSurface(x0, y0, width, height, pose)
  const end = projectSurface(x1, y1, width, height, pose)
  const mid = projectSurface((x0 + x1) / 2, (y0 + y1) / 2, width, height, pose)
  const control = { x: 2 * mid.x - (start.x + end.x) / 2, y: 2 * mid.y - (start.y + end.y) / 2 }
  return `${move ? `M${pointText(start)}` : ''}Q${pointText(control)} ${pointText(end)}`
}

export function smoothSurfacePath(points) {
  if (points.length < 2) return ''
  let path = `M${pointText(points[0])}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[Math.max(0, i - 1)]
    const b = points[i]
    const c = points[i + 1]
    const d = points[Math.min(points.length - 1, i + 2)]
    const first = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 }
    const second = { x: c.x - (d.x - b.x) / 6, y: c.y - (d.y - b.y) / 6 }
    path += `C${pointText(first)} ${pointText(second)} ${pointText(c)}`
  }
  return path
}

export function tracePath({ width, height, slot, transform, phase, shape, sample, pose }) {
  const { hScale, hOff } = transform
  const sourceX = (x) => (((x - slot.x) / slot.width * 220 - hOff - 110) / hScale + 110) - phase
  const screenX = (x) => slot.x + ((x + phase - 110) * hScale + 110 + hOff) / 220 * slot.width
  const screenY = (y) => slot.y + signalScreenY(y, transform) / 100 * slot.height
  if (shape === 1) {
    // Retain true vertical transitions rather than smoothing the square wave.
    const halfPeriod = SQUARE_PERIOD / 2
    const edges = [0]
    for (let n = Math.ceil(sourceX(0) / halfPeriod); n <= Math.floor(sourceX(width) / halfPeriod); n += 1) {
      const x = screenX(n * halfPeriod)
      if (x > 0 && x < width) edges.push(x)
    }
    edges.push(width)
    let path = ''
    let previousY = null
    for (let i = 0; i < edges.length - 1; i += 1) {
      const x0 = edges[i]
      const x1 = edges[i + 1]
      const half = Math.floor(sourceX((x0 + x1) / 2) / halfPeriod)
      const y = screenY(((half % 2) + 2) % 2 === 0 ? SQUARE_BOTTOM : SQUARE_TOP)
      if (previousY !== null) path += surfaceLine(x0, previousY, x0, y, width, height, pose, false)
      path += surfaceLine(x0, y, x1, y, width, height, pose, previousY === null)
      previousY = y
    }
    return path
  }
  const points = []
  const count = Math.ceil(width / 2)
  for (let i = 0; i <= count; i += 1) {
    const x = i / count * width
    points.push(projectSurface(x, screenY(sample(sourceX(x))), width, height, pose))
  }
  return smoothSurfacePath(points)
}
