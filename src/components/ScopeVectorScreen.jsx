import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { CRT_CORNER_X, CRT_CORNER_Y, surfaceDepth, tracePath } from './crtSurface.mjs'
import { presentationPhase } from './scopeSignals.mjs'

// A shared depth map lets the browser warp the complete phosphor image in one
// pass. Red and green receive separate view-angle gains in the SVG filter.
const depthStops = Array.from({ length: 17 }, (_, index) => {
  const offset = index / 16
  const depth = Math.round(255 * (1 - offset ** 2))
  return `<stop offset="${offset}" stop-color="rgb(${depth},${depth},0)"/>`
}).join('')
const depthMap = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><radialGradient id="d" r="70.7107%">${depthStops}</radialGradient></defs><rect width="128" height="128" fill="url(#d)"/></svg>`,
)}`
const REFRACTION = 0.46
const RIM_WIDTH = 14

// A neutral center and inward sampling at the rounded edge keep the image
// legible while the glass bevel bends its outermost pixels.
function makeRimMap(width, height) {
  const canvas = document.createElement('canvas')
  const resolution = Math.min(1, 512 / Math.max(width, height))
  canvas.width = Math.ceil(width * resolution)
  canvas.height = Math.ceil(height * resolution)
  const context = canvas.getContext('2d')
  if (!context) return null
  const map = context.createImageData(canvas.width, canvas.height)
  const halfWidth = width / 2
  const halfHeight = height / 2
  const radius = Math.min(width * CRT_CORNER_X, height * CRT_CORNER_Y)
  for (let row = 0; row < canvas.height; row += 1) {
    const y = (row + 0.5) / resolution - halfHeight
    const edgeY = Math.abs(y) - halfHeight + radius
    for (let column = 0; column < canvas.width; column += 1) {
      const x = (column + 0.5) / resolution - halfWidth
      const edgeX = Math.abs(x) - halfWidth + radius
      const outside = Math.hypot(Math.max(0, edgeX), Math.max(0, edgeY))
      const distance = radius - outside - Math.min(0, Math.max(edgeX, edgeY))
      const t = Math.max(0, 1 - Math.abs(distance) / RIM_WIDTH)
      const bend = 127 * t * t * (3 - 2 * t)
      const corner = edgeX > 0 && edgeY > 0
      const nx = corner ? edgeX / outside : Number(edgeX > edgeY)
      const ny = corner ? edgeY / outside : Number(edgeX <= edgeY)
      const i = (row * canvas.width + column) * 4
      map.data[i] = 128 - bend * nx * Math.sign(x)
      map.data[i + 1] = 128 - bend * ny * Math.sign(y)
      map.data[i + 3] = 255
    }
  }
  context.putImageData(map, 0, 0)
  return canvas.toDataURL()
}

function measureScreenLayout(element, root) {
  const dimensions = (node) => {
    const style = getComputedStyle(node)
    return { width: parseFloat(style.width), height: parseFloat(style.height) }
  }
  const rootSize = dimensions(root)
  const part = dimensions(element)
  const matrix = (node) => {
    const transform = node ? getComputedStyle(node).transform : 'none'
    return new DOMMatrixReadOnly(transform === 'none' ? undefined : transform)
  }
  const camera = matrix(root.closest('.scope-front-plane')).multiply(matrix(root.closest('.scope-chassis')))
  const layout = element.closest('.scope-crt-layout')
  const animation = matrix(layout)
  const projected = camera.multiply(animation)
  const origin = (node, size, basis) => {
    const box = node.getBoundingClientRect()
    const { a, b, c, d } = basis
    return {
      x: box.left - Math.min(0, a * size.width) - Math.min(0, c * size.height),
      y: box.top - Math.min(0, b * size.width) - Math.min(0, d * size.height),
    }
  }
  const from = origin(root, rootSize, camera)
  const { a, b, c, d } = camera
  const det = a * d - b * c
  const local = (point) => {
    const dx = point.x - from.x
    const dy = point.y - from.y
    return { x: (dx * d - dy * c) / det, y: (dy * a - dx * b) / det }
  }
  let point = local(origin(element, part, projected))
  if (layout && !animation.isIdentity) {
    // The power-on animation compresses the layout around its center. Undo
    // that temporary transform so its on-screen position is never cached as
    // the resting waveform position.
    const anchor = local(origin(layout, dimensions(layout), projected))
    const [ox, oy] = getComputedStyle(layout).transformOrigin.split(' ').map(parseFloat)
    const transformedOrigin = new DOMPoint(-ox, -oy).matrixTransform(animation)
    const offset = new DOMPoint(point.x - anchor.x, point.y - anchor.y, 0, 0).matrixTransform(animation.inverse())
    point = { x: anchor.x - ox - transformedOrigin.x + offset.x, y: anchor.y - oy - transformedOrigin.y + offset.y }
  }
  return { ...rootSize, slot: { ...part, ...point } }
}

export function ScopeVectorScreen({ surfaceRef, acquisitionRef, waveSlotRef, waves, triggerColor, triggerX, triggerY, triggerLocked, triggerSource, powerState }) {
  const filterId = useId()
  const warpRef = useRef(null)
  const warpXRef = useRef(null)
  const warpYRef = useRef(null)
  const rimImageRef = useRef(null)
  const rimMapRef = useRef(null)
  const rimWarpRef = useRef(null)
  const svgRef = useRef(null)
  const horizontalRef = useRef(null)
  const verticalRef = useRef(null)
  const tracesRef = useRef(new Map())
  const guideRef = useRef(null)
  const measureRef = useRef(null)

  useLayoutEffect(() => { measureRef.current?.() }, [powerState])

  useEffect(() => {
    const svg = svgRef.current
    const phosphor = svg?.parentElement
    const image = phosphor?.parentElement
    if (!svg || !image || !waveSlotRef.current) return undefined
    image.style.setProperty('--crt-image-filter', `url("#${filterId}")`)
    const positionMarker = waveSlotRef.current.querySelector('.scope-trigger-position-marker')
    const levelMarker = waveSlotRef.current.querySelector('.scope-trigger-marker')
    let size = null
    let lastGridPose = ''
    let lastCapture = NaN
    let lastBlend = NaN
    const lastPhases = new Map()
    const draw = () => {
      if (!size) return
      const { width, height, slot } = size
      const pose = surfaceRef.current.pose ?? { x: 0, y: 0 }
      const gridPose = `${pose.x.toFixed(6)},${pose.y.toFixed(6)},${(pose.depth ?? 0).toFixed(6)}`
      if (gridPose !== lastGridPose) {
        const strength = pose.depth ?? 0
        warpXRef.current.setAttribute('slope', -pose.x * strength)
        warpYRef.current.setAttribute('slope', -pose.y * strength)
        rimWarpRef.current.setAttribute('scale', rimMapRef.current?.url ? 5 * strength : 0)
        for (const [marker, x, y] of [
          [positionMarker, slot.x + slot.width * triggerX / 100, slot.y],
          [levelMarker, slot.x + slot.width - 17, slot.y + slot.height * triggerY / 100],
        ]) {
          const depth = surfaceDepth(x, y, width, height) * REFRACTION * strength
          marker?.style.setProperty('--crt-hit-x', `${depth * pose.x}px`)
          marker?.style.setProperty('--crt-hit-y', `${depth * pose.y}px`)
        }
        lastGridPose = gridPose
      }
      const guideX = slot.x + slot.width * triggerX / 100
      guideRef.current.setAttribute('d', `M${guideX},${slot.y}v${slot.height}`)
      const acquisition = acquisitionRef.current
      const capture = acquisition.capture
      const blend = acquisition.remainder
      if (lastCapture !== capture || lastBlend !== blend) {
        for (const wave of waves) {
          const group = tracesRef.current.get(wave.slug)
          if (!group) continue
          const phase = presentationPhase(acquisition, wave.period, wave.slug === triggerSource)
          if (lastPhases.get(wave.slug) === phase) continue
          const path = tracePath({ width, height, slot, transform: wave.transform, phase, shape: wave.shapeIndex, sample: wave.sample, pose: { x: 0, y: 0 } })
          group.querySelector('.scope-vector-beam').setAttribute('d', path)
          group.querySelector('.scope-vector-beam-halo').setAttribute('d', path)
          const label = group.querySelector('text')
          label.setAttribute('x', 16)
          label.setAttribute('y', slot.y + (50 + wave.transform.vOff) / 100 * slot.height)
          group.dataset.phase = phase.toFixed(9)
          lastPhases.set(wave.slug, phase)
        }
        lastCapture = capture
        lastBlend = blend
        svg.dataset.captureTime = capture.toFixed(9)
        svg.dataset.captureBlend = blend.toFixed(9)
      }
      svg.dataset.projectionX = pose.x.toFixed(6)
      svg.dataset.projectionY = pose.y.toFixed(6)
    }
    const measure = () => {
      size = measureScreenLayout(waveSlotRef.current, phosphor)
      const { width, height } = size
      if (!width || !height) { size = null; return }
      if (rimMapRef.current?.width !== width || rimMapRef.current?.height !== height) {
        rimMapRef.current = { width, height, url: makeRimMap(width, height) }
        if (rimMapRef.current.url) rimImageRef.current.setAttribute('href', rimMapRef.current.url)
      }
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      const horizontal = []
      const vertical = []
      for (let x = 0; x <= width; x += 24) vertical.push(`M${x},0v${height}`)
      for (let y = 0; y <= height; y += 24) horizontal.push(`M0,${y}h${width}`)
      horizontalRef.current.setAttribute('d', horizontal.join(''))
      verticalRef.current.setAttribute('d', vertical.join(''))
      const rise = surfaceDepth(width / 2, height / 2, width, height)
      warpRef.current.setAttribute('scale', rise * REFRACTION)
      svg.dataset.surfaceRise = rise.toFixed(3)
      lastGridPose = ''
      lastCapture = NaN
      lastBlend = NaN
      lastPhases.clear()
      draw()
    }
    surfaceRef.current.render = draw
    measureRef.current = measure
    const observer = new ResizeObserver(measure)
    observer.observe(phosphor)
    observer.observe(waveSlotRef.current)
    const layout = waveSlotRef.current.closest('.scope-crt-layout')
    if (layout) observer.observe(layout)
    measure()
    return () => {
      observer.disconnect()
      if (surfaceRef.current.render === draw) surfaceRef.current.render = null
      if (measureRef.current === measure) measureRef.current = null
      image.style.removeProperty('--crt-image-filter')
      for (const marker of [positionMarker, levelMarker]) {
        marker?.style.removeProperty('--crt-hit-x')
        marker?.style.removeProperty('--crt-hit-y')
      }
    }
  }, [filterId, surfaceRef, acquisitionRef, waveSlotRef, waves, triggerX, triggerY, triggerSource])

  return <svg ref={svgRef} className="scope-screen-grid scope-vector-screen" aria-hidden="true" preserveAspectRatio="none" data-crt-renderer="projected-vector" data-trigger-source={triggerSource} data-triggered={triggerLocked}>
    <defs>
      <filter id={filterId} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={depthMap} preserveAspectRatio="none" result="depth" />
        <feComponentTransfer in="depth" result="offset">
          <feFuncR ref={warpXRef} type="linear" slope="0" intercept="0.5" />
          <feFuncG ref={warpYRef} type="linear" slope="0" intercept="0.5" />
        </feComponentTransfer>
        <feDisplacementMap ref={warpRef} in="SourceGraphic" in2="offset" xChannelSelector="R" yChannelSelector="G" result="curved" />
        <feImage ref={rimImageRef} preserveAspectRatio="none" result="rim" />
        <feGaussianBlur in="rim" stdDeviation="1.5" edgeMode="duplicate" result="smoothRim" />
        <feDisplacementMap ref={rimWarpRef} in="curved" in2="smoothRim" scale="0" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
    <g className="scope-vector-graticule" fill="none">
      <path ref={horizontalRef} className="scope-vector-grid-horizontal" />
      <path ref={verticalRef} className="scope-vector-grid-vertical" />
    </g>
    <path ref={guideRef} style={{ stroke: triggerColor }} className={`scope-vector-trigger ${triggerLocked ? '' : 'is-searching'}`} fill="none" />
    {waves.map((wave) => <g key={wave.slug} data-signal={wave.slug}
      ref={(node) => { if (node) tracesRef.current.set(wave.slug, node); else tracesRef.current.delete(wave.slug) }}
      style={{ '--wave-color': wave.color }}
    >
      <path className="scope-vector-beam-halo" fill="none" />
      <path className={`scope-vector-beam ${wave.shapeIndex === 1 ? 'is-square' : ''}`} fill="none" />
      <text className="scope-vector-channel" dominantBaseline="middle">{wave.label}</text>
    </g>)}
  </svg>
}
