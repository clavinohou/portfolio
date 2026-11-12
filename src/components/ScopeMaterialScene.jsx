import { Component, Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox as DetailBox } from '@react-three/drei/core/RoundedBox'
import { Environment } from '@react-three/drei/core/Environment'
import { Lightformer } from '@react-three/drei/core/Lightformer'
import { useTexture } from '@react-three/drei/core/Texture'
import { useProgress } from '@react-three/drei/core/Progress'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { BoxGeometry, CanvasTexture, CylinderGeometry, ExtrudeGeometry, MathUtils, Object3D, Path, PlaneGeometry, RepeatWrapping, Shape, SRGBColorSpace, Vector3 } from 'three'
import { CRT_CORNER_X, CRT_CORNER_Y, surfaceDepth } from './crtSurface.mjs'
import { ROCKER_INSET, ROCKER_THICKNESS, ROCKER_BEVEL, ROCKER_TILT, rockerPivotHeight, rockerSideProfile } from './rockerMechanics.mjs'
import { PANEL_SURFACE, BEZEL_RADIUS_X, BEZEL_RADIUS_Y, panelFaceMask, bezelFaceMask } from './panelFinish.mjs'
import { CarryAir, createScopeCarry, useScopeCarry } from './ScopeCarry'
import { carryHandleProfile, HANDLE_HALF_SPAN, HANDLE_GRIP_WIDTH, HANDLE_THICKNESS, HANDLE_EDGE_RADIUS, HANDLE_PIVOT_LIFT, HANDLE_PIVOT_Z } from './scopeHardware.mjs'

RectAreaLightUniformsLib.init()

// Material and studio calibration live together so the next visual pass can
// change the finish without changing the front-panel layout or interaction.
const FINISH = {
  color: '#e5e6e5',
  metalness: 0.9,
  roughness: 0.64,
  environmentIntensity: 1.0,
  keyIntensity: 0.65,
}
// Match the pale 2D faceplate while retaining the physical finish and shadows.
// The fill compensates for the dark studio reflections on the front face only.
const PANEL_FINISH = {
  color: '#e5e8e1',
  fill: '#d8dad5',
  fillIntensity: 0.12,
}
const CAMERA_DISTANCE = 1800
function renderDpr(lowQuality, width, height) {
  const budget = lowQuality ? 1_200_000 : 2_200_000
  return Math.min(window.devicePixelRatio, lowQuality ? 1 : 1.5,
    Math.max(0.65, Math.sqrt(budget / Math.max(1, width * height))))
}
const BEZEL_DEPTH = 20
const PHOSPHOR_DEPTH = 4
const GLASS_THICKNESS = 5
const GLASS_DEPTH = PHOSPHOR_DEPTH + GLASS_THICKNESS
const ALUMINUM_TEXTURES = [
  '/materials/aluminum/base-color.png',
  '/materials/aluminum/roughness.png',
  '/materials/aluminum/normal.png',
]

// These fillets cover only a few screen pixels. Keep the same rounded shape
// without the default sixteen bevel layers on every small component.
function RoundedBox({ bevelSegments = 2, smoothness = 3, ...props }) {
  return <DetailBox bevelSegments={bevelSegments} smoothness={smoothness} {...props} />
}

export function preloadScopeMaterials() {
  useTexture.preload(ALUMINUM_TEXTURES)
  useTexture.preload(PANEL_SURFACE.grain)
}

class MaterialBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onReady(false)
  }

  render() {
    return this.state.failed ? <span hidden data-material-status="failed" /> : this.props.children
  }
}

function measurePart(element, chassis, scale) {
  let left = 0
  let top = 0
  let current = element
  while (current && current !== chassis) {
    left += current.offsetLeft
    top += current.offsetTop
    const parent = current.offsetParent
    // offsetLeft/Top start at the parent's padding edge. Include its border
    // so the glass and masks land on the same pixels as their HTML surfaces.
    if (parent) {
      left += parent.clientLeft
      top += parent.clientTop
    }
    current = parent
  }
  return {
    x: (left + element.offsetWidth / 2 - chassis.offsetWidth / 2) * scale,
    y: (chassis.offsetHeight / 2 - top - element.offsetHeight / 2) * scale,
    width: element.offsetWidth * scale,
    height: element.offsetHeight * scale,
  }
}

function usePanelLayout(chassisRef, scale) {
  const [layout, setLayout] = useState(null)
  useLayoutEffect(() => {
    const chassis = chassisRef.current
    if (!chassis) return undefined
    const measure = () => {
      const bezel = chassis.querySelector('.scope-crt-bezel')
      const glass = chassis.querySelector('.scope-crt-glass')
      const parts = (selector) => [...chassis.querySelectorAll(selector)].map((el) => measurePart(el, chassis, scale))
      const next = {
        knobs: [...chassis.querySelectorAll('.scope-knob-stack')].map((el) => measurePart(el, chassis, scale)),
        inputs: parts('.scope-input-rocker'),
        inputSelectors: parts('.scope-input-select'),
        bezel: bezel ? measurePart(bezel, chassis, scale) : null,
        glass: glass ? measurePart(glass, chassis, scale) : null,
        channels: parts('.scope-ch-btn'),
        power: parts('.scope-power-cluster')[0],
      }
      setLayout((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(chassis)
    const contentObserver = new MutationObserver(measure)
    contentObserver.observe(chassis, { subtree: true, characterData: true, childList: true })
    measure()
    return () => { observer.disconnect(); contentObserver.disconnect() }
  }, [chassisRef, scale])
  return layout
}

function Aluminum({ width, height }) {
  const source = useTexture(ALUMINUM_TEXTURES)
  const maps = useMemo(() => source.map((original, index) => {
    const texture = original.clone()
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.set(width / 128, height / 128)
    texture.anisotropy = 4
    if (index === 0) texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }), [source, width, height])
  useEffect(() => () => maps.forEach((map) => map.dispose()), [maps])
  return (
    <meshStandardMaterial
      color={FINISH.color}
      metalness={FINISH.metalness}
      roughness={FINISH.roughness}
      envMapIntensity={FINISH.environmentIntensity}
      map={maps[0]}
      roughnessMap={maps[1]}
      normalMap={maps[2]}
      normalScale={[0.12, 0.12]}
    />
  )
}

function PanelFaceMaterial({ width, height, scale }) {
  const grain = useTexture(PANEL_SURFACE.grain)
  const shaderRef = useRef(null)
  const sourceWidth = Math.ceil(width / scale)
  const sourceHeight = Math.ceil(height / scale)
  const surface = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = sourceWidth
    canvas.height = sourceHeight
    const ctx = canvas.getContext('2d')
    const angle = PANEL_SURFACE.angle * Math.PI / 180
    const dx = Math.sin(angle), dy = -Math.cos(angle)
    const extent = (Math.abs(dx) * canvas.width + Math.abs(dy) * canvas.height) / 2
    const gradient = ctx.createLinearGradient(canvas.width / 2 - dx * extent, canvas.height / 2 - dy * extent,
      canvas.width / 2 + dx * extent, canvas.height / 2 + dy * extent)
    PANEL_SURFACE.stops.forEach(([at, color]) => gradient.addColorStop(at, color))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = ctx.createPattern(grain.image, 'repeat')
    const grainScale = PANEL_SURFACE.grainSize / grain.image.width
    ctx.scale(grainScale, grainScale)
    ctx.fillRect(0, 0, canvas.width / grainScale, canvas.height / grainScale)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }, [sourceWidth, sourceHeight, grain])
  useEffect(() => () => surface.dispose(), [surface])
  const values = useRef(null)
  values.current = { surface, size: [width, height] }
  useLayoutEffect(() => {
    if (!shaderRef.current) return
    shaderRef.current.uniforms.panelSurface.value = surface
    shaderRef.current.uniforms.panelSize.value = values.current.size
  }, [surface, width, height])
  const compile = useCallback((shader) => {
    shaderRef.current = shader
    shader.uniforms.panelSurface = { value: values.current.surface }
    shader.uniforms.panelSize = { value: values.current.size }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelPosition;\nvarying vec3 vPanelNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanelPosition = position;\nvPanelNormal = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D panelSurface;\nuniform vec2 panelSize;\nvarying vec3 vPanelPosition;\nvarying vec3 vPanelNormal;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        vec2 panelUV = vPanelPosition.xy / panelSize + vec2(0.5);
        vec3 panelNormal = normalize(vPanelNormal);
        vec3 panelLight = normalize(vec3(-0.4, 0.8, 1.0));
        float panelShade = clamp((0.65 + 0.35 * dot(panelNormal, panelLight)) / (0.65 + 0.35 * panelLight.z), 0.65, 1.04);
        gl_FragColor.rgb = texture2D(panelSurface, panelUV).rgb * panelShade;`)
  }, [])
  return <meshStandardMaterial color={PANEL_FINISH.color} emissive={PANEL_FINISH.fill}
    emissiveIntensity={PANEL_FINISH.fillIntensity} metalness={0.35} roughness={0.55}
    toneMapped={false} onBeforeCompile={compile} />
}

// Keep the studio fixed across progress updates and capture it on a render
// frame, after the geometry has mounted.
const Studio = memo(function Studio() {
  return (
    <Environment resolution={128} frames={2}>
      <mesh>
        <sphereGeometry args={[30, 16, 16]} />
        <meshBasicMaterial color="#a5aaa7" side={1} />
      </mesh>
      <Lightformer position={[-8, 9, 10]} scale={[12, 7]} intensity={2.6} />
      <Lightformer position={[10, 3, 6]} scale={[5, 12]} intensity={0.7} />
      <Lightformer position={[0, -10, 5]} scale={[14, 2]} intensity={0.35} />
    </Environment>
  )
})

function makeFrontHousing(width, height, scale) {
  const depth = 108 * scale
  const half = new Vector3(width / 2 + 7 * scale, height / 2 + 9 * scale, depth / 2)
  const radius = 9 * scale
  const inner = half.clone().subScalar(radius)
  // Flat panels need only one span. Cluster vertices at the rolled edges
  // and handle recesses instead of tessellating every square of the case.
  const axis = (extent, extra = []) => [...new Set([
    ...Array.from({ length: 5 }, (_, index) => extent - radius + radius * index / 4),
    ...Array.from({ length: 5 }, (_, index) => -extent + radius * index / 4),
    0, ...extra,
  ].map((value) => MathUtils.clamp(value, -extent, extent)))].sort((a, b) => a - b)
  const pivot = width * HANDLE_HALF_SPAN
  const xs = axis(half.x, [-1, 1].flatMap((side) =>
    [-38, -31, -23, 0, 23, 31, 38].map((offset) => side * pivot + offset * scale),
  ))
  const ys = axis(half.y, [38, 30, 24, 18, 12].map((offset) => half.y - offset * scale))
  const zs = axis(half.z, [36, 44, 52, 60, 68, 76, 84].map((offset) => half.z - offset * scale))
  const geometry = new BoxGeometry(
    half.x * 2, half.y * 2, depth,
    xs.length - 1, ys.length - 1, zs.length - 1,
  )
  const positions = geometry.attributes.position
  const point = new Vector3()
  const core = new Vector3()
  for (let i = 0; i < positions.count; i += 1) {
    point.fromBufferAttribute(positions, i)
    point.set(
      xs[Math.round((point.x / (2 * half.x) + 0.5) * (xs.length - 1))],
      ys[Math.round((point.y / (2 * half.y) + 0.5) * (ys.length - 1))],
      zs[Math.round((point.z / depth + 0.5) * (zs.length - 1))],
    )
    core.set(
      MathUtils.clamp(point.x, -inner.x, inner.x),
      MathUtils.clamp(point.y, -inner.y, inner.y),
      MathUtils.clamp(point.z, -inner.z, inner.z),
    )
    point.sub(core).setLength(radius).add(core)

    // Blend both rear-open handle pockets into the rounded top and rear face.
    const fromPivot = Math.abs(Math.abs(point.x) - pivot)
    const pocketWidth = 1 - MathUtils.smoothstep(fromPivot, 23 * scale, 38 * scale)
    const pocketDepth = MathUtils.smoothstep(half.z - point.z, 36 * scale, 68 * scale)
    const top = MathUtils.smoothstep(point.y, half.y - 38 * scale, half.y)
    point.y -= 24 * scale * pocketWidth * pocketDepth * top
    positions.setXYZ(i, point.x, point.y, point.z - half.z)
  }
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')
  const housing = mergeVertices(geometry)
  geometry.dispose()
  housing.computeVertexNormals()
  // Two rounded cheeks cradle each arm around a shared pin. Their feet blend
  // into the pocket walls, rather than leaving the handle on an exposed edge.
  // Flared feet sink into the pocket walls; the top and pivot clearance
  // stay unchanged so both handle positions retain the same silhouette.
  const cheekShape = new Shape()
  cheekShape.moveTo(-23 * scale, -28 * scale)
  cheekShape.quadraticCurveTo(-25 * scale, -28 * scale, -24 * scale, -24 * scale)
  cheekShape.lineTo(-15 * scale, 8 * scale)
  cheekShape.quadraticCurveTo(-14 * scale, 17 * scale, -6 * scale, 17 * scale)
  cheekShape.lineTo(6 * scale, 17 * scale)
  cheekShape.quadraticCurveTo(14 * scale, 17 * scale, 15 * scale, 8 * scale)
  cheekShape.lineTo(24 * scale, -24 * scale)
  cheekShape.quadraticCurveTo(25 * scale, -28 * scale, 23 * scale, -28 * scale)
  cheekShape.closePath()
  const cheekSource = new ExtrudeGeometry(cheekShape, {
    depth: 5 * scale, bevelEnabled: true, bevelSize: 1.5 * scale,
    bevelThickness: 1.5 * scale, bevelSegments: 2, curveSegments: 6,
  })
  cheekSource.translate(0, 0, -2.5 * scale)
  cheekSource.rotateY(Math.PI / 2)
  cheekSource.deleteAttribute('uv')
  const cheek = mergeVertices(cheekSource)
  cheekSource.dispose()
  const cheeks = [-1, 1].flatMap((side) => [-1, 1].map((edge) => {
    const part = cheek.clone()
    part.translate(side * pivot + edge * 28 * scale, height / 2 + scale, HANDLE_PIVOT_Z * scale)
    return part
  }))
  const complete = mergeGeometries([housing, ...cheeks])
  housing.dispose()
  cheek.dispose()
  cheeks.forEach((part) => part.dispose())
  return complete
}

function VentSlots({ width, height, depth, scale }) {
  const mesh = useRef(null)
  const { invalidate } = useThree()
  useLayoutEffect(() => {
    const slot = new Object3D()
    let index = 0
    for (let i = 0; i < 12; i += 1) {
      slot.position.set((i - 5.5) * 22 * scale, height / 2 * (1 - 0.58 * 0.065) + 0.4, -depth * 0.58)
      slot.rotation.set(-Math.PI / 2, 0, 0)
      slot.scale.set(5 * scale, depth * 0.48, 1)
      slot.updateMatrix()
      mesh.current.setMatrixAt(index++, slot.matrix)
    }
    for (const side of [-1, 1]) for (let i = 0; i < 7; i += 1) {
      slot.position.set(side * (width / 2 * (1 - 0.56 * 0.045) + 0.4), (i - 3) * 17 * scale, -depth * 0.56)
      slot.rotation.set(0, side * Math.PI / 2, 0)
      slot.scale.set(depth * 0.52, 3 * scale, 1)
      slot.updateMatrix()
      mesh.current.setMatrixAt(index++, slot.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
    invalidate()
  }, [width, height, depth, scale, invalidate])
  return <instancedMesh ref={mesh} args={[null, null, 26]}>
    <planeGeometry args={[1, 1]} />
    <meshStandardMaterial color="#525852" roughness={0.85} />
  </instancedMesh>
}

function refreshShadows(gl, lightRef) {
  // Keep the cache on the light: an offscreen render must not consume a
  // global dirty flag before the instrument's shadow has been updated.
  if (lightRef.current) lightRef.current.shadow.needsUpdate = true
  gl.shadowMap.needsUpdate = true
}

function HandleGripRibs({ geometry, scale }) {
  const mesh = useRef(null)
  const { invalidate } = useThree()
  useLayoutEffect(() => {
    const rib = new Object3D()
    for (let index = 0; index < 11; index += 1) {
      rib.position.set((index - 5) * 19 * scale, 0, 0)
      rib.updateMatrix()
      mesh.current.setMatrixAt(index, rib.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
    invalidate()
  }, [scale, invalidate])
  return <instancedMesh ref={mesh} name="carry-handle-grip-ribs" geometry={geometry} args={[null, null, 11]}>
    <meshStandardMaterial color="#333a35" roughness={0.72} />
  </instancedMesh>
}

function Instrument({ fit, handleRaised, handleHitRef, shadowLightRef }) {
  const { width, height, scale } = fit
  const { camera, size, gl, invalidate } = useThree()
  const hinge = useRef(null)
  const grip = useRef(null)
  const projected = useMemo(() => new Vector3(), [])
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const depth = 440 * scale
  const foldedAngle = -Math.atan(height * 0.065 / (2 * depth))
  const enclosure = useMemo(() => {
    const geometry = new RoundedBoxGeometry(width, height, depth, 5, 12 * scale)
    const positions = geometry.attributes.position
    // A folded case narrows behind its cast front rim, rather than extruding
    // the faceplate into a single slab.
    for (let i = 0; i < positions.count; i += 1) {
      const rear = (depth / 2 - positions.getZ(i)) / depth
      positions.setX(i, positions.getX(i) * (1 - rear * 0.045))
      positions.setY(i, positions.getY(i) * (1 - rear * 0.065))
    }
    geometry.computeVertexNormals()
    return geometry
  }, [width, height, depth, scale])
  const housing = useMemo(() => makeFrontHousing(width, height, scale), [width, height, scale])
  const topShadow = useMemo(() => {
    // Follow the folded case's actual taper, behind the cast front housing.
    // A horizontal catcher floats above this surface and leaves a ghost rim.
    const length = depth - 72 * scale
    const centerZ = -depth / 2 - 44 * scale
    const geometry = new PlaneGeometry(width - 24 * scale, length)
    geometry.rotateX(-Math.PI / 2)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i += 1) {
      const z = positions.getZ(i) + centerZ
      const rear = (-z - 20 * scale) / depth
      positions.setXYZ(i, positions.getX(i) * (1 - rear * 0.045),
        height / 2 * (1 - rear * 0.065) + 0.4 * scale, z)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [width, height, depth, scale])
  const { handle, outline, gripRib } = useMemo(() => {
    // A short molded bow, with broad arms, rounded pivot ends, and generous
    // inside fillets carrying the crossbar into the arms.
    const { commands, back, innerBack } = carryHandleProfile(width, scale)
    const gripOutline = new Shape()
    commands.forEach(([method, ...args]) => gripOutline[method](...args))

    const bevel = HANDLE_EDGE_RADIUS * scale
    const coreDepth = (HANDLE_THICKNESS - 2 * HANDLE_EDGE_RADIUS) * scale
    const geometry = new ExtrudeGeometry(gripOutline, {
      depth: coreDepth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 4,
      curveSegments: 12,
    })
    geometry.translate(0, 0, -coreDepth / 2)

    // Fine ribs wrap the rounded cross-section; their relief catches the same
    // light as the handle, without painted stripes or an extra texture.
    const ribShape = roundedRect(new Shape(), (HANDLE_GRIP_WIDTH + 2 * HANDLE_EDGE_RADIUS + 1) * scale,
      (HANDLE_THICKNESS + 1) * scale, bevel + 0.5 * scale, bevel + 0.5 * scale)
    ribShape.holes.push(roundedRect(new Path(), (HANDLE_GRIP_WIDTH + 2 * HANDLE_EDGE_RADIUS - 0.4) * scale,
      (HANDLE_THICKNESS - 0.4) * scale, bevel - 0.2 * scale, bevel - 0.2 * scale))
    const rib = new ExtrudeGeometry(ribShape, {
      depth: 1.2 * scale, bevelEnabled: true, bevelSize: 0.2 * scale,
      bevelThickness: 0.2 * scale, bevelSegments: 1, curveSegments: 8,
    })
    const vertices = rib.attributes.position
    const normals = rib.attributes.normal
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getZ(index) - 0.6 * scale
      const y = vertices.getX(index) + (back + innerBack) / 2
      const z = vertices.getY(index)
      const nx = normals.getZ(index), ny = normals.getX(index), nz = normals.getY(index)
      vertices.setXYZ(index, x, y, z)
      normals.setXYZ(index, nx, ny, nz)
    }
    rib.computeBoundingSphere()
    return { handle: geometry, outline: gripOutline.getPoints(6), gripRib: rib }
  }, [width, scale])
  const pins = useMemo(() => {
    const pin = new CylinderGeometry(4.5 * scale, 4.5 * scale, 62 * scale, 16)
    pin.rotateZ(Math.PI / 2)
    const pair = [-1, 1].map((side) => {
      const part = pin.clone()
      part.translate(side * width * HANDLE_HALF_SPAN, height / 2 + HANDLE_PIVOT_LIFT * scale, HANDLE_PIVOT_Z * scale)
      return part
    })
    const geometry = mergeGeometries(pair)
    pin.dispose()
    pair.forEach((part) => part.dispose())
    return geometry
  }, [width, height, scale])
  useEffect(() => () => enclosure.dispose(), [enclosure])
  useEffect(() => () => housing.dispose(), [housing])
  useEffect(() => () => topShadow.dispose(), [topShadow])
  useEffect(() => () => handle.dispose(), [handle])
  useEffect(() => () => gripRib.dispose(), [gripRib])
  useEffect(() => () => pins.dispose(), [pins])
  useEffect(() => invalidate(), [handleRaised, invalidate])
  useFrame((_, delta) => {
    const target = handleRaised ? MathUtils.degToRad(78) : foldedAngle
    const angle = hinge.current.rotation.x
    hinge.current.rotation.x = reducedMotion.matches || Math.abs(target - angle) < 0.001
      ? target
      : MathUtils.damp(angle, target, 9, Math.min(delta, 0.05))
    if (hinge.current.rotation.x !== target) invalidate()
    if (hinge.current.rotation.x !== angle) refreshShadows(gl, shadowLightRef)

    const hit = handleHitRef.current
    if (!hit) return
    grip.current.updateWorldMatrix(true, false)
    // Project both caps and the walls between them. A single cap misses the
    // inside face when the folded or raised handle is viewed at an angle.
    const caps = [-1, 1].map((side) => outline.map(({ x, y }) => {
      projected.set(x, y, side * HANDLE_THICKNESS / 2 * scale).applyMatrix4(grip.current.matrixWorld).project(camera)
      return { x: (projected.x + 1) * size.width / 2, y: (1 - projected.y) * size.height / 2 }
    }))
    const polygons = [...caps, ...outline.map((_, index) => {
      const next = (index + 1) % outline.length
      return [caps[0][index], caps[0][next], caps[1][next], caps[1][index]]
    })]
    const path = polygons.map((polygon) => {
      // Consistent winding unions overlapping faces under SVG's nonzero
      // fill rule without making the open space inside the bow grabbable.
      const area = polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length]
        return sum + point.x * next.y - next.x * point.y
      }, 0)
      const points = area < 0 ? [...polygon].reverse() : polygon
      return points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z'
    }).join('')
    hit.setAttribute('d', path)
  }, -0.5)
  return (
    <group>
      <mesh geometry={enclosure} position={[0, 0, -depth / 2 - 20 * scale]} castShadow>
        <Aluminum width={width} height={height} />
      </mesh>
      <mesh geometry={housing} castShadow>
        <PanelFaceMaterial width={width} height={height} scale={scale} />
      </mesh>
      {/* Separate receivers avoid self-shadow acne along the fine bevels. */}
      <mesh position={[0, 0, 0.4]} receiveShadow>
        <planeGeometry args={[width - 14 * scale, height - 14 * scale]} />
        <shadowMaterial transparent opacity={0.22} />
      </mesh>
      <mesh name="case-top-shadow" geometry={topShadow} receiveShadow>
        <shadowMaterial transparent opacity={0.22} />
      </mesh>
      {/* Inset the rear plate inside the radius of the shell corners. */}
      <RoundedBox args={[width * 0.955 - 36 * scale, height * 0.935 - 36 * scale, 6 * scale]} radius={2 * scale} smoothness={2} position={[0, 0, -depth - 19 * scale]}>
        <meshStandardMaterial color="#939590" metalness={0.7} roughness={0.6} />
      </RoundedBox>
      {/* Real side and top details make the enclosure depth legible as the
          camera travels; the front controls remain in their original layout. */}
      <VentSlots width={width} height={height} depth={depth} scale={scale} />
      <mesh name="carry-handle-pins" geometry={pins}>
        <meshStandardMaterial color="#687469" metalness={0.65} roughness={0.58} />
      </mesh>
      <group ref={hinge} name="carry-handle-hinge" position={[0, height / 2 + HANDLE_PIVOT_LIFT * scale, HANDLE_PIVOT_Z * scale]} rotation={[foldedAngle, 0, 0]}>
        <mesh ref={grip} name="carry-handle" geometry={handle} position={[0, 0, -HANDLE_PIVOT_Z * scale]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <meshStandardMaterial color="#333a35" roughness={0.65} />
          <HandleGripRibs geometry={gripRib} scale={scale} />
        </mesh>
      </group>
      {[-1, 1].flatMap((side) => [0.18, 0.8].map((z) => {
        const mountBottom = -height / 2 - 7 * scale
        // Follow the underside taper and overlap the case at the rear of each mount.
        const mountTop = -height / 2 + height / 2 * 0.065 * z + 7 * scale
        return (
          <group key={`foot-${side}-${z}`} position={[side * width * 0.38, 0, -depth * z]}>
            <RoundedBox args={[56 * scale, mountTop - mountBottom, 52 * scale]} radius={5 * scale} smoothness={3} position={[0, (mountTop + mountBottom) / 2, 0]} castShadow>
              <meshStandardMaterial color="#f0f1ec" metalness={0.12} roughness={0.56} />
            </RoundedBox>
            <RoundedBox args={[42 * scale, 14 * scale, 38 * scale]} radius={4 * scale} smoothness={3} position={[0, -height / 2 - 11 * scale, 0]} castShadow>
              <meshStandardMaterial color="#303731" roughness={0.9} />
            </RoundedBox>
          </group>
        )
      }))}
    </group>
  )
}

function roundedRect(path, width, height, rx, ry) {
  const x = width / 2
  const y = height / 2
  const k = 1 - 0.5522847498
  path.moveTo(-x + rx, -y)
  path.lineTo(x - rx, -y)
  path.bezierCurveTo(x - rx * k, -y, x, -y + ry * k, x, -y + ry)
  path.lineTo(x, y - ry)
  path.bezierCurveTo(x, y - ry * k, x - rx * k, y, x - rx, y)
  path.lineTo(-x + rx, y)
  path.bezierCurveTo(-x + rx * k, y, -x, y - ry * k, -x, y - ry)
  path.lineTo(-x, -y + ry)
  path.bezierCurveTo(-x, -y + ry * k, -x + rx * k, -y, -x + rx, -y)
  path.closePath()
  return path
}

function makeRockerTop(width, height, scale) {
  const bevel = ROCKER_BEVEL * scale
  const shape = roundedRect(new Shape(), width - 2 * ROCKER_INSET * scale - 2 * bevel,
    height - 2 * ROCKER_INSET * scale - 2 * bevel, 2.4 * scale, 2.4 * scale)
  const geometry = new ExtrudeGeometry(shape, {
    depth: ROCKER_THICKNESS * scale - 2 * bevel,
    bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, steps: 1, curveSegments: 6,
  })
  geometry.translate(0, 0, -ROCKER_THICKNESS * scale / 2 + bevel)
  return geometry
}

function makeRockerUnderside(width, height, scale) {
  const profile = rockerSideProfile(height, scale).map(([y, z], index) =>
    [y * 0.96, index < 2 ? -1.5 * scale : z],
  )
  const shape = new Shape()
  profile.forEach(([y, z], index) => {
    if (index === 0) shape.moveTo(y, z)
    else shape.lineTo(y, z)
  })
  shape.closePath()
  const capWidth = width - 2 * ROCKER_INSET * scale - 3 * scale
  const bevel = ROCKER_BEVEL * scale
  const geometry = new ExtrudeGeometry(shape, {
    depth: capWidth - 2 * bevel,
    bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, steps: 1, curveSegments: 1,
  })
  const vertices = geometry.attributes.position
  const normals = geometry.attributes.normal
  const uv = geometry.attributes.uv
  // Extrude the side profile across the cap, with the same grain scale as
  // the housing rather than stretching the texture around the sidewalls.
  for (let i = 0; i < vertices.count; i += 1) {
    const x = vertices.getZ(i) - capWidth / 2 + bevel
    const y = vertices.getX(i)
    const z = vertices.getY(i)
    const nx = normals.getZ(i)
    const ny = normals.getX(i)
    const nz = normals.getY(i)
    vertices.setXYZ(i, x, y, z)
    normals.setXYZ(i, nx, ny, nz)
    uv.setXY(i, Math.abs(nx) > Math.abs(nz) ? z / capWidth : x / capWidth, Math.abs(ny) > Math.abs(nz) ? z / height : y / height)
  }
  geometry.computeBoundingSphere()
  return geometry
}

function InputPlasticMaterial({ input, height, materials }) {
  const shaderRef = useRef(null)
  const heightRef = useRef(height)
  heightRef.current = height
  const ref = useCallback((material) => {
    if (material) materials.current.set(input.slug, material)
    else materials.current.delete(input.slug)
  }, [input.slug, materials])
  useLayoutEffect(() => {
    if (shaderRef.current) shaderRef.current.uniforms.plasticHeight.value = height
  }, [height])
  const compile = useCallback((shader) => {
    shaderRef.current = shader
    shader.uniforms.plasticHeight = { value: heightRef.current }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float plasticHeight;\nvarying vec3 vPlasticNormal;\nvarying float vPlasticHeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlasticNormal = normal;\nvPlasticHeight = position.y / plasticHeight + 0.5;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlasticNormal;\nvarying float vPlasticHeight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float plasticRim = 1.0 - smoothstep(0.78, 0.98, abs(normalize(vPlasticNormal).z));
        totalEmissiveRadiance *= plasticRim * (1.0 - 0.65 * clamp(vPlasticHeight, 0.0, 1.0));`)
  }, [])
  return <meshStandardMaterial ref={ref} color="#edf0e7" transparent opacity={0.76} depthWrite={false}
    emissive={input.color} emissiveIntensity={0} roughness={0.4} onBeforeCompile={compile} />
}

function InputSelector({ part, input, scale, chassisRef, spatialActive, materials, shadowLightRef }) {
  const capRef = useRef(null)
  const elementRef = useRef(null)
  const pressed = useRef(input.selected ? 1 : 0)
  const target = input.selected ? 1 : 0
  const motion = useRef({ from: target, to: target, elapsed: 0.14 })
  const { gl, invalidate } = useThree()
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  useLayoutEffect(() => {
    elementRef.current = chassisRef.current?.querySelector(`.scope-input-select[data-channel="${input.slug}"]`)
    return () => elementRef.current?.style.removeProperty('--selector-press')
  }, [chassisRef, input.slug])
  useEffect(() => {
    motion.current = { from: pressed.current, to: target, elapsed: pressed.current === target ? 0.14 : 0 }
    invalidate()
  }, [target, invalidate])
  useFrame((_, delta) => {
    const movement = motion.current
    movement.elapsed += Math.min(delta, 0.05)
    const { from, to } = movement
    const t = reducedMotion.matches ? 1 : Math.min(1, movement.elapsed / 0.14)
    const next = MathUtils.lerp(from, to, MathUtils.smoothstep(t, 0, 1))
    if (next !== pressed.current) refreshShadows(gl, shadowLightRef)
    pressed.current = next
    // The HTML face and translucent cap share one short latching movement.
    capRef.current.position.z = (3 - 3 * next) * scale
    if (spatialActive) elementRef.current?.style.setProperty('--selector-press', next.toFixed(4))
    else elementRef.current?.style.removeProperty('--selector-press')
    if (t < 1) invalidate()
  }, -0.5)
  return <RoundedBox ref={capRef} name={`channel-selector-${input.slug}`}
    args={[part.width, part.height, 6 * scale]} radius={2.5 * scale}
    position={[part.x, part.y, (3 - 3 * pressed.current) * scale]} castShadow
  ><InputPlasticMaterial input={input} height={part.height} materials={materials} /></RoundedBox>
}

function RockerInput({ part, input, scale, chassisRef, isPoweredOn, spatialActive, selectorMaterials, shadowLightRef }) {
  const capRef = useRef(null)
  const elementRef = useRef(null)
  const bankRef = useRef(null)
  const emitterRef = useRef(null)
  const cap = useMemo(() => {
    const top = makeRockerTop(part.width, part.height, scale)
    const underside = makeRockerUnderside(part.width, part.height, scale)
    const geometry = mergeGeometries([top, underside])
    top.dispose()
    underside.dispose()
    return geometry
  }, [part.width, part.height, scale])
  useEffect(() => () => cap.dispose(), [cap])
  const { gl, invalidate } = useThree()
  const target = (input.enabled ? 1 : -1) * ROCKER_TILT
  const pivotHeight = rockerPivotHeight(part.height, scale)
  const initialRotation = useRef([target, 0, 0])
  const motion = useRef({ from: target, to: target, start: 0 })
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  useLayoutEffect(() => {
    elementRef.current = chassisRef.current?.querySelector(`[data-input="${input.slug}"]`)
    bankRef.current = elementRef.current?.parentElement
    return () => {
      elementRef.current?.style.removeProperty('--rocker-angle')
      bankRef.current?.style.removeProperty('--rocker-open')
    }
  }, [chassisRef, input.slug])
  useEffect(() => {
    motion.current = { from: capRef.current.rotation.x, to: target, start: performance.now() }
    invalidate()
  }, [target, invalidate])
  useFrame(() => {
    const { from, to, start } = motion.current
    const t = reducedMotion.matches ? 1 : Math.min(1, (performance.now() - start) / 180)
    const angle = MathUtils.lerp(from, to, MathUtils.smoothstep(t, 0, 1))
    if (capRef.current.rotation.x !== angle) refreshShadows(gl, shadowLightRef)
    capRef.current.rotation.x = angle
    const opening = MathUtils.smoothstep(angle, 0, ROCKER_TILT)
    if (spatialActive) {
      elementRef.current?.style.setProperty('--rocker-angle', `${-angle}rad`)
      bankRef.current?.style.setProperty('--rocker-open', opening.toFixed(4))
    } else {
      elementRef.current?.style.removeProperty('--rocker-angle')
      bankRef.current?.style.removeProperty('--rocker-open')
    }
    const light = isPoweredOn ? opening : 0
    if (emitterRef.current) emitterRef.current.emissiveIntensity = 2.5 * light
    const plastic = selectorMaterials.current.get(input.slug)
    if (plastic) plastic.emissiveIntensity = 0.8 * light
    if (t < 1) invalidate()
  }, -0.5)
  return <>
    <group name={`input-rocker-${input.slug}`} position={[part.x, part.y, 0]}>
    <RoundedBox args={[part.width, part.height, 0.8 * scale]} radius={0.3 * scale} position={[0, 0, -0.35 * scale]}>
      <meshStandardMaterial color={PANEL_FINISH.color} emissive={PANEL_FINISH.fill} emissiveIntensity={PANEL_FINISH.fillIntensity} roughness={0.55} metalness={0.35} />
    </RoundedBox>
    <RoundedBox args={[part.width - 14 * scale, 7 * scale, pivotHeight]} radius={1.5 * scale} position={[0, 0, pivotHeight / 2]} castShadow>
      <meshStandardMaterial color="#b4b8b1" metalness={0.7} roughness={0.6} />
    </RoundedBox>
    <mesh position={[0, 0, pivotHeight]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[1.8 * scale, 1.8 * scale, part.width - scale, 12]} />
      <meshStandardMaterial color="#989e96" metalness={0.7} roughness={0.6} />
    </mesh>
    <RoundedBox args={[part.width * 0.5, 3 * scale, scale]} radius={0.4 * scale} position={[0, part.height / 2 - 6.5 * scale, scale]}>
      <meshStandardMaterial ref={emitterRef} color="#d9ddd5" emissive={input.color} emissiveIntensity={0} roughness={0.3} />
    </RoundedBox>
    <group ref={capRef} name={`input-cap-${input.slug}`} position={[0, 0, pivotHeight]} rotation={initialRotation.current}>
      <mesh geometry={cap} castShadow>
        <meshStandardMaterial color={PANEL_FINISH.color} roughness={0.55} metalness={0.35} />
      </mesh>
    </group>
    </group>
  </>
}

function TubeGlassMaterial() {
  return <meshPhysicalMaterial color="#07120c" roughness={0.2} clearcoat={0.5}
    clearcoatRoughness={0.22} envMapIntensity={0.5} specularIntensity={0.45} />
}

function PanelDepth({ fit, layout, isPoweredOn, inputs, chassisRef, spatialActive, shadowLightRef }) {
  const { scale } = fit
  const { gl, invalidate } = useThree()
  const selectorMaterials = useRef(new Map())
  useEffect(() => {
    refreshShadows(gl, shadowLightRef)
    invalidate()
  }, [gl, invalidate, layout, isPoweredOn, shadowLightRef])
  const ring = useMemo(() => {
    if (!layout.bezel || !layout.glass) return null
    const shape = roundedRect(new Shape(), layout.bezel.width - 2 * scale, layout.bezel.height - 2 * scale,
      (BEZEL_RADIUS_X - 1) * scale, (BEZEL_RADIUS_Y - 1) * scale)
    shape.holes.push(roundedRect(new Path(), layout.glass.width, layout.glass.height, layout.glass.width * CRT_CORNER_X, layout.glass.height * CRT_CORNER_Y))
    return new ExtrudeGeometry(shape, { depth: (BEZEL_DEPTH - 3) * scale, bevelEnabled: true, bevelSize: scale, bevelThickness: scale, bevelSegments: 3, curveSegments: 16 })
  }, [layout, scale])
  const glass = useMemo(() => {
    if (!layout.glass) return null
    const { width, height } = layout.glass
    const geometry = new PlaneGeometry(width, height, 40, 28)
    const vertices = geometry.attributes.position
    const rx = width * CRT_CORNER_X
    const ry = height * CRT_CORNER_Y
    for (let i = 0; i < vertices.count; i += 1) {
      let x = vertices.getX(i)
      let y = vertices.getY(i)
      const cornerX = Math.max(0, Math.abs(x) - (width / 2 - rx))
      const cornerY = Math.max(0, Math.abs(y) - (height / 2 - ry))
      const distance = Math.hypot(cornerX / rx, cornerY / ry)
      if (distance > 1) {
        x -= Math.sign(x) * cornerX * (1 - 1 / distance)
        y -= Math.sign(y) * cornerY * (1 - 1 / distance)
      }
      // The face bows out in the middle, then seats behind the bezel at
      // the entire perimeter so the mesh can't cross the lip in profile.
      const edge = Math.max(2 * Math.abs(x) / width, 2 * Math.abs(y) / height, distance)
      const rise = surfaceDepth(x + width / 2, height / 2 - y, width, height)
      vertices.setXYZ(i, x, y, rise * (1 - MathUtils.smoothstep(edge, 0.72, 1)))
    }
    geometry.computeVertexNormals()
    return geometry
  }, [layout.glass])
  useEffect(() => () => ring?.dispose(), [ring])
  useEffect(() => () => glass?.dispose(), [glass])
  return <>
    {layout.bezel ? <RoundedBox args={[layout.bezel.width - 6 * scale, layout.bezel.height - 6 * scale, 2 * scale]} radius={18 * scale} position={[layout.bezel.x, layout.bezel.y, scale]}>
      <meshStandardMaterial color="#070d09" roughness={0.9} />
    </RoundedBox> : null}
    {ring ? <mesh name="display-bezel" geometry={ring} position={[layout.bezel.x, layout.bezel.y, 2 * scale]}>
      <meshStandardMaterial color="#14161a" roughness={0.8} metalness={0.03} />
    </mesh> : null}
    {glass ? <mesh name="display-glass" geometry={glass} position={[layout.glass.x, layout.glass.y, GLASS_DEPTH * scale]}>
      <TubeGlassMaterial />
    </mesh> : null}
    {layout.knobs.map((knob, index) => <group key={index} position={[knob.x, knob.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 3 * scale, 0]}><cylinderGeometry args={[knob.width / 2 + scale, knob.width / 2 + scale, 5 * scale, 48]} /><meshStandardMaterial color="#8d9687" metalness={0.65} roughness={0.45} /></mesh>
      <mesh name={`knob-side-${index}`} position={[0, 12 * scale, 0]}><cylinderGeometry args={[knob.width / 2, knob.width / 2, 20 * scale, 48]} /><meshStandardMaterial color="#c8cfc1" metalness={0.4} roughness={0.4} /></mesh>
    </group>)}
    {layout.inputs.map((part, index) => <RockerInput key={inputs[index].slug}
      part={part} input={inputs[index]} scale={scale} chassisRef={chassisRef} isPoweredOn={isPoweredOn}
      spatialActive={spatialActive} selectorMaterials={selectorMaterials} shadowLightRef={shadowLightRef}
    />)}
    {layout.inputSelectors.map((part, index) => <InputSelector key={inputs[index].slug}
      part={part} input={inputs[index]} scale={scale} chassisRef={chassisRef}
      spatialActive={spatialActive} materials={selectorMaterials} shadowLightRef={shadowLightRef}
    />)}
    {layout.channels.map((part, index) => <RoundedBox key={index} name={`channel-key-${index + 1}`} args={[part.width - 2 * scale, part.height - 2 * scale, 18 * scale]} radius={3 * scale} position={[part.x, part.y, 8.75 * scale]}>
      <meshStandardMaterial color="#a0a799" roughness={0.55} metalness={0.15} />
    </RoundedBox>)}
    {layout.power ? <RoundedBox args={[layout.power.width, layout.power.height, 12 * scale]} radius={3 * scale} position={[layout.power.x, layout.power.y, (isPoweredOn ? 2 : 12) * scale]} castShadow>
      <meshStandardMaterial color="#abb59f" roughness={0.5} metalness={0.25} />
    </RoundedBox> : null}
  </>
}

function CameraLight({ fit, active, onReady, onProgress, lowQuality, onSlow, interaction, planeRef, chassisRef, surfaceRef, threeD, presented, pointerRef, progressRef, handleRaised, shadowLightRef, carryRef, stageRef, instrumentRef, handleHitRef, setHandleRaised }) {
  const { camera, size, gl, scene, invalidate, setDpr } = useThree()
  const warmup = useRef({ generation: 0, raf: 0, phase: 'pending', fence: null })
  const points = useMemo(() => Array.from({ length: 4 }, () => new Vector3()), [])
  const motion = useRef({ x: 0, y: 0, orbitX: 0, orbitY: 220, handleFraming: 0, frames: 0, seconds: 0, lowerQuality: false, transition: null })
  const worldOrigin = useMemo(() => new Vector3(), [])
  const followCamera = useMemo(() => camera.clone(), [camera])
  const shadowPosition = useMemo(() => new Vector3(NaN, NaN, NaN), [])
  useScopeCarry({ carryRef, stageRef, instrumentRef, handleHitRef, shadowLightRef, interaction, motion, active, setHandleRaised })
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const finePointer = useMemo(() => window.matchMedia('(hover: hover) and (pointer: fine)'), [])

  useEffect(() => { if (presented) invalidate() }, [presented, invalidate])

  useEffect(() => {
    const state = motion.current
    const from = progressRef.current
    if (threeD) {
      const pointer = finePointer.matches && !reducedMotion.matches ? pointerRef.current : null
      state.x = pointer ? MathUtils.clamp(pointer.x / window.innerWidth * 2 - 1, -1, 1) : 0
      state.y = pointer ? MathUtils.clamp(1 - pointer.y / window.innerHeight * 2, -1, 1) : 0
      // In the front view these coordinates are invisible. Seed the reveal
      // with today's cursor position, rather than the previous 3D orbit.
      if (from === 0) {
        state.orbitX = state.x * 1100
        state.orbitY = 220 + state.y * 420
      }
    }
    const to = threeD ? 1 : 0
    state.transition = from === to ? null : { from, to, start: null, duration: Math.max(180, 900 * Math.abs(to - from)) }
    invalidate()
  }, [threeD, progressRef, pointerRef, finePointer, reducedMotion, invalidate])

  useEffect(() => {
    setDpr(renderDpr(lowQuality, size.width, size.height))
    const shadow = shadowLightRef.current?.shadow
    if (shadow) {
      shadow.map?.dispose()
      shadow.map = null
      shadow.mapPass?.dispose()
      shadow.mapPass = null
    }
    if (shadowLightRef.current && stageRef.current) shadowLightRef.current.target = stageRef.current
    gl.shadowMap.autoUpdate = true
    refreshShadows(gl, shadowLightRef)
    invalidate()
  }, [lowQuality, setDpr, gl, fit, size.width, size.height, invalidate, shadowLightRef, stageRef])

  useEffect(() => {
    const state = motion.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const move = (event) => {
      if (!active || !threeD || interaction.current || carryRef.current.pose || reduced.matches || !fine.matches) return
      // Hold the current pose as the pointer reaches a control. Otherwise
      // hover-driven orbit can move its hit target before a click lands.
      if (progressRef.current === 1 && event.target instanceof Element && (
        event.target.closest('.scope-handle-hit path') ||
        (chassisRef.current?.contains(event.target) && event.target.closest('button, a'))
      )) {
        state.x = state.orbitX / 1100
        state.y = (state.orbitY - 220) / 420
        invalidate()
        return
      }
      // Zero is straight ahead. Both ends of the viewport have equal travel.
      state.x = MathUtils.clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1)
      state.y = MathUtils.clamp(1 - event.clientY / window.innerHeight * 2, -1, 1)
      invalidate()
    }
    const reset = () => { carryRef.current.api?.end(null, true); state.x = state.y = 0; invalidate() }
    const resume = () => { if (!document.hidden) invalidate() }
    const down = (event) => { if (chassisRef.current?.contains(event.target)) interaction.current = true }
    const up = (event) => { carryRef.current.api?.end(event.pointerId, event.type === 'pointercancel', event.timeStamp); interaction.current = false; invalidate() }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', resume)
    document.documentElement.addEventListener('pointerleave', reset)
    reduced.addEventListener('change', reset)
    invalidate()
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', resume)
      document.documentElement.removeEventListener('pointerleave', reset)
      reduced.removeEventListener('change', reset)
    }
  }, [active, threeD, interaction, invalidate, chassisRef, camera, progressRef, carryRef])

  useLayoutEffect(() => {
    const preparation = warmup.current
    preparation.phase = 'pending'
    preparation.generation += 1
    invalidate()
    const plane = planeRef.current
    const chassis = chassisRef.current
    chassis?.style.setProperty('--crt-corner-x', `${CRT_CORNER_X * 100}%`)
    chassis?.style.setProperty('--crt-corner-y', `${CRT_CORNER_Y * 100}%`)
    chassis?.style.setProperty('--crt-bezel-depth', `${BEZEL_DEPTH}px`)
    chassis?.style.setProperty('--crt-glass-depth', `${GLASS_DEPTH}px`)
    return () => {
      preparation.generation += 1
      cancelAnimationFrame(preparation.raf)
      if (preparation.fence) {
        gl.getContext().deleteSync(preparation.fence)
        preparation.fence = null
      }
      plane?.style.removeProperty('transform')
      chassis?.style.removeProperty('--crt-clip')
      chassis?.style.removeProperty('--crt-bezel-depth')
      chassis?.style.removeProperty('--crt-glass-depth')
      chassis?.style.removeProperty('--crt-corner-x')
      chassis?.style.removeProperty('--crt-corner-y')
      chassis?.style.removeProperty('--crt-light-angle')
      chassis?.style.removeProperty('--crt-phosphor-offset')
      surfaceRef.current.pose = { x: 0, y: 0, depth: 1 }
      surfaceRef.current.render?.()
      onReady(false)
    }
  }, [onReady, planeRef, chassisRef, surfaceRef, gl, invalidate])

  useFrame((_, delta) => {
    if (!active || document.hidden) return
    const state = motion.current
    const carry = carryRef.current
    const locked = Boolean(carry.pose)
    const transition = state.transition
    let transitioning = false
    if (!locked && presented && transition) {
      const now = performance.now()
      if (transition.start === null) transition.start = now
      const t = reducedMotion.matches ? 1 : Math.min(1, (now - transition.start) / transition.duration)
      // Only the camera moves. Its velocity reaches zero at either view.
      const eased = t * t * t * (t * (t * 6 - 15) + 10)
      progressRef.current = MathUtils.lerp(transition.from, transition.to, eased)
      transitioning = t < 1
      if (!transitioning) state.transition = null
    }
    const view = progressRef.current
    const x = state.x * 1100
    const y = 220 + state.y * 420
    if (!locked && !interaction.current && threeD) {
      state.orbitX = MathUtils.damp(state.orbitX, x, 8, Math.min(delta, 0.05))
      state.orbitY = MathUtils.damp(state.orbitY, y, 8, Math.min(delta, 0.05))
    }
    const framingTarget = handleRaised ? 1 : 0
    if (!locked) state.handleFraming = reducedMotion.matches || Math.abs(framingTarget - state.handleFraming) < 0.001
      ? framingTarget : MathUtils.damp(state.handleFraming, framingTarget, 9, Math.min(delta, 0.05))
    const lift = 54 * fit.scale * state.handleFraming
    const spatialZoom = Math.min(0.9, (size.width - 64) / (fit.width + 260 * fit.scale), (size.height - 140) / (fit.height + 180 * fit.scale))
    if (locked) {
      const following = carry.recovery?.progress || 0
      if (carry.followCursor && threeD) {
        const pointer = finePointer.matches && !reducedMotion.matches ? pointerRef.current : null
        state.x = pointer ? MathUtils.clamp(pointer.x / window.innerWidth * 2 - 1, -1, 1) : 0
        state.y = pointer ? MathUtils.clamp(1 - pointer.y / window.innerHeight * 2, -1, 1) : 0
        carry.followOrbitX = reducedMotion.matches ? state.x * 1100 : MathUtils.damp(carry.followOrbitX, state.x * 1100, 8, Math.min(delta, 0.05))
        carry.followOrbitY = reducedMotion.matches ? 220 + state.y * 420 : MathUtils.damp(carry.followOrbitY, 220 + state.y * 420, 8, Math.min(delta, 0.05))
      } else if (!carry.followCursor) {
        carry.followOrbitX = carry.pose.orbitX
        carry.followOrbitY = carry.pose.orbitY
        state.x = carry.followOrbitX / 1100
        state.y = (carry.followOrbitY - 220) / 420
      }
      const finalLift = 54 * fit.scale * framingTarget
      followCamera.position.set(carry.followOrbitX * view, carry.followOrbitY * view + finalLift, CAMERA_DISTANCE)
      followCamera.lookAt(0, finalLift, -100 * fit.scale * view)
      state.handleFraming = MathUtils.lerp(carry.pose.framing, framingTarget, following)
      camera.position.copy(carry.pose.position).sub(carry.pose.origin).lerp(followCamera.position, following).add(carry.offset)
      camera.quaternion.slerpQuaternions(carry.pose.quaternion, followCamera.quaternion, following)
      if (following > 0) { state.orbitX = carry.followOrbitX; state.orbitY = carry.followOrbitY }
      if (carry.drag) {
        const t = reducedMotion.matches ? 1 : carry.drag.pickup
        const eased = t * t * t * (t * (t * 6 - 15) + 10)
        camera.zoom = MathUtils.lerp(carry.pose.zoom, MathUtils.lerp(1, spatialZoom, view) * 0.8, eased)
      } else camera.zoom = MathUtils.lerp(carry.releaseZoom ?? carry.pose.zoom,
        MathUtils.lerp(1, spatialZoom, view) * (1 - 0.10 * framingTarget), following)
    } else {
      camera.position.set(state.orbitX * view, state.orbitY * view + lift, CAMERA_DISTANCE).add(carry.offset)
      camera.lookAt(carry.offset.x, carry.offset.y + lift, carry.offset.z - 100 * fit.scale * view)
      camera.zoom = MathUtils.lerp(1, spatialZoom, view) * (1 - 0.10 * state.handleFraming)
    }
    carry.cameraShakeOffset.set(0, 0, 0)
    if (carry.shake && !reducedMotion.matches) {
      const t = carry.shake.elapsed / 0.28
      const force = carry.shake.strength * (1 - t) ** 2 / camera.zoom
      carry.cameraShakeOffset.set(Math.sin(t * Math.PI * 8) * 3.5 * force,
        Math.sin(t * Math.PI * 11) * 5.5 * force, 0).applyQuaternion(camera.quaternion)
      camera.position.add(carry.cameraShakeOffset)
    }
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    stageRef.current?.updateMatrixWorld(true)
    instrumentRef.current?.getWorldPosition(worldOrigin)
    if (stageRef.current && !shadowPosition.equals(stageRef.current.position)) {
      shadowPosition.copy(stageRef.current.position)
      const light = shadowLightRef.current
      // The studio and floor translate with the stage. Its cached shadow
      // texture stays valid; only its world-space projection needs moving.
      if (light) light.shadow.updateMatrices(light)
    }
    // Project the original HTML panel as a 3D coordinate system. Individual
    // parts keep their original typography and layout at their own Z depths.
    const project = (point, x, y, z) => {
      point.set(x, y, z).add(worldOrigin).project(camera)
      point.set((point.x + 1) * size.width / 2, (1 - point.y) * size.height / 2, 0)
      return point
    }
    const origin = project(points[0], -fit.width / 2, fit.height / 2, 0)
    const right = project(points[1], -fit.width / 2 + 1, fit.height / 2, 0).sub(origin)
    const down = project(points[2], -fit.width / 2, fit.height / 2 - 1, 0).sub(origin)
    const forward = project(points[3], -fit.width / 2, fit.height / 2, 1).sub(origin)
    const inverse = camera.matrixWorldInverse.elements
    if (planeRef.current) {
      planeRef.current.style.transform = `matrix3d(${right.x},${right.y},${inverse[2]},0,${down.x},${down.y},${-inverse[6]},0,${forward.x},${forward.y},${inverse[10]},0,${origin.x - (size.width - fit.width) / 2},${origin.y - (size.height - fit.height) / 2},0,1)`
    }
    // The front lip occludes the back glass at oblique angles. Clip the HTML
    // phosphor against that opening instead of letting it paint over the wall.
    const determinant = right.x * down.y - right.y * down.x
    const pose = {
      x: (forward.x * down.y - forward.y * down.x) / determinant,
      y: (forward.y * right.x - forward.x * right.y) / determinant,
      depth: 1,
    }
    const oldPose = surfaceRef.current.pose
    const poseChanged = Math.abs(pose.x - oldPose.x) + Math.abs(pose.y - oldPose.y) + Math.abs(pose.depth - (oldPose.depth ?? 0)) > 0.000001
    if (poseChanged) {
      const style = chassisRef.current?.style
      const dx = pose.x * (BEZEL_DEPTH - GLASS_DEPTH)
      const dy = pose.y * (BEZEL_DEPTH - GLASS_DEPTH)
      style?.setProperty('--crt-clip', `${Math.max(0, dy)}px ${Math.max(0, -dx)}px ${Math.max(0, -dy)}px ${Math.max(0, dx)}px`)
      style?.setProperty('--crt-light-angle', `${140 + pose.x * 96 - pose.y * 34}deg`)
      if (pose.x || pose.y) style?.setProperty('--crt-phosphor-offset', `translate(${-pose.x * GLASS_THICKNESS}px, ${-pose.y * GLASS_THICKNESS}px)`)
      else style?.removeProperty('--crt-phosphor-offset')
      surfaceRef.current.pose = pose
      surfaceRef.current.render?.()
    }
    gl.domElement.dataset.viewProgress = view.toFixed(6)
    gl.domElement.dataset.presentation = presented ? '1.000000' : '0.000000'
    gl.domElement.dataset.orbitX = camera.position.x.toFixed(2)
    gl.domElement.dataset.orbitY = camera.position.y.toFixed(2)
    gl.domElement.dataset.carryState = carry.phase
    gl.domElement.dataset.impactShake = String(Boolean(carry.shake))
    const cursorAligned = !threeD || !carry.followCursor ||
      Math.abs(carry.followOrbitX - state.x * 1100) + Math.abs(carry.followOrbitY - (220 + state.y * 420)) < 0.1
    if (carry.finished && locked && cursorAligned) carry.api?.unlock()
    const moving = !locked && threeD && view === 1 && !interaction.current && Math.abs(state.orbitX - x) + Math.abs(state.orbitY - y) > 0.1
    if ((moving || transitioning) && !lowQuality) {
      // The first delta includes the time the on-demand renderer was idle.
      if (state.frames > 0) state.seconds += Math.min(delta, 0.25)
      if (state.frames >= 6 && state.seconds >= 0.35) {
        if (state.seconds / state.frames > 1 / 38) state.lowerQuality = true
        state.frames = state.seconds = 0
      }
      state.frames += 1
    } else { state.frames = state.seconds = 0 }
    // Reallocating the canvas and shadow map would interrupt the camera move.
    if (state.lowerQuality && !transitioning) {
      state.lowerQuality = false
      onSlow()
    }
    if (moving || transitioning || (!locked && state.handleFraming !== framingTarget)) invalidate()
  }, -1)

  // Take over drawing so the first render cannot force shader compilation
  // before the asynchronous warm-up has finished.
  useFrame(() => {
    if (!active || document.hidden) return
    const preparation = warmup.current
    if (preparation.phase === 'ready') {
      gl.render(scene, camera)
      return
    }

    const generation = preparation.generation
    const fail = () => {
      if (generation !== preparation.generation) return
      preparation.phase = 'failed'
      onReady(false)
    }
    if (preparation.phase === 'pending') {
      preparation.phase = 'compiling'
      onProgress(0.82)
      preparation.raf = requestAnimationFrame(async () => {
        if (generation !== preparation.generation) return
        try {
          if (gl.extensions.has('KHR_parallel_shader_compile')) await gl.compileAsync(scene, camera)
          else gl.compile(scene, camera)
          if (generation !== preparation.generation) return
          preparation.phase = 'compiled'
          invalidate()
        } catch {
          fail()
        }
      })
    } else if (preparation.phase === 'compiled') {
      preparation.phase = 'drawing'
      const context = gl.getContext()
      try {
        gl.render(scene, camera)
        preparation.fence = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
        context.flush()
      } catch {
        fail()
        return
      }
      onProgress(0.96)

      // The first hidden draw uploads geometry and textures and fills the
      // shadow map. Keep the HTML front visible until that draw completes.
      const reveal = () => {
        if (generation !== preparation.generation) return
        if (preparation.fence) {
          const status = context.clientWaitSync(preparation.fence, 0, 0)
          if (status === context.TIMEOUT_EXPIRED) {
            preparation.raf = requestAnimationFrame(reveal)
            return
          }
          context.deleteSync(preparation.fence)
          preparation.fence = null
          if (status === context.WAIT_FAILED) {
            fail()
            return
          }
        }
        if (context.isContextLost()) {
          fail()
          return
        }
        preparation.phase = 'ready'
        onReady(true)
        invalidate()
      }
      preparation.raf = requestAnimationFrame(reveal)
    }
  }, 1)

  const bounds = Math.max(fit.width, fit.height) * 1.2
  return (
    <>
      <rectAreaLight position={[-500, 700, 1000]} rotation={[0, -0.2, 0]} color="#fffdf8" intensity={4} width={fit.width} height={fit.height} />
      <directionalLight ref={shadowLightRef} position={[-400, 1400, 1500]} intensity={FINISH.keyIntensity} color="#fffdf7" castShadow
        shadow-autoUpdate={false}
        shadow-mapSize={[lowQuality ? 512 : 1024, lowQuality ? 512 : 1024]}
        shadow-camera-left={-bounds} shadow-camera-right={bounds} shadow-camera-top={bounds} shadow-camera-bottom={-bounds}
        shadow-camera-near={100} shadow-camera-far={5000} shadow-normalBias={1.5} shadow-bias={-0.0015}
        shadow-radius={6} shadow-blurSamples={8} />
    </>
  )
}

export default memo(function ScopeMaterialScene({ chassisRef, planeRef, surfaceRef, fit, active, threeD, spatialActive, pointerRef, onReady, onProgress, isPoweredOn, inputs }) {
  const assetProgress = useProgress((state) => state.progress)
  useEffect(() => { onProgress(0.18 + assetProgress / 100 * 0.57) }, [assetProgress, onProgress])
  const layout = usePanelLayout(chassisRef, fit.scale)
  useLayoutEffect(() => {
    const chassis = chassisRef.current
    if (!chassis || !layout?.bezel) return undefined
    chassis.style.setProperty('--panel-face-mask', panelFaceMask(fit, layout.bezel))
    chassis.style.setProperty('--case-face-mask', panelFaceMask(fit, layout.bezel, 7, 9))
    const bezel = chassis.querySelector('.scope-crt-bezel')
    if (bezel && layout.glass) bezel.style.setProperty('--bezel-face-mask', bezelFaceMask(fit.scale, layout.bezel, layout.glass))
    return () => {
      chassis.style.removeProperty('--panel-face-mask')
      chassis.style.removeProperty('--case-face-mask')
      bezel?.style.removeProperty('--bezel-face-mask')
    }
  }, [chassisRef, fit, layout])
  const interaction = useRef(false)
  const progressRef = useRef(0)
  const shadowLightRef = useRef(null)
  const [presented, setPresented] = useState(false)
  const [lowQuality, setLowQuality] = useState(() =>
    (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4,
  )
  const reduceQuality = useCallback(() => setLowQuality(true), [])
  useEffect(() => {
    surfaceRef.current.frameInterval = lowQuality ? 1000 / 30 : 0
  }, [lowQuality, surfaceRef])
  const [lost, setLost] = useState(false)
  const [handleRaised, setHandleRaised] = useState(false)
  const handleHitRef = useRef(null)
  const stageRef = useRef(null)
  const instrumentRef = useRef(null)
  const carryRef = useRef(null)
  if (!carryRef.current) carryRef.current = createScopeCarry()
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const lose = () => { onReady(false); setLost(true) }
    canvas.addEventListener('webglcontextlost', lose)
    return () => canvas.removeEventListener('webglcontextlost', lose)
  }, [onReady])

  if (lost) return <span hidden data-material-status="context-lost" />
  return (
    <MaterialBoundary onReady={onReady}>
      <div className="scope-material-scene" onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'scopeMaterialReveal') setPresented(true)
      }}>
        <Canvas
          aria-hidden="true"
          ref={canvasRef}
          orthographic
          camera={{ position: [0, 0, CAMERA_DISTANCE], near: 1, far: 6000, zoom: 1 }}
          dpr={renderDpr(lowQuality, window.innerWidth, window.innerHeight)}
          frameloop={active ? 'demand' : 'never'}
          shadows="variance"
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          fallback={null}
        >
          <Suspense fallback={null}>
          <Studio />
          <group ref={stageRef} name="scope-stage">
          <group ref={instrumentRef} name="scope-instrument">
            <Instrument fit={fit} handleRaised={handleRaised} handleHitRef={handleHitRef} shadowLightRef={shadowLightRef} />
            {layout ? <PanelDepth fit={fit} layout={layout} isPoweredOn={isPoweredOn} inputs={inputs} chassisRef={chassisRef} spatialActive={spatialActive} shadowLightRef={shadowLightRef} /> : null}
          </group>
          <mesh name="scope-ground-shadow" position={[0, -fit.height / 2 - 18 * fit.scale, -220 * fit.scale]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[12000, 12000]} />
            <shadowMaterial transparent opacity={0.18} />
          </mesh>
          <CarryAir carryRef={carryRef} fit={fit} stageRef={stageRef} />
          {layout ? <CameraLight threeD={threeD} presented={presented} pointerRef={pointerRef} progressRef={progressRef} surfaceRef={surfaceRef} planeRef={planeRef} chassisRef={chassisRef} fit={fit} active={active} onReady={onReady} onProgress={onProgress} lowQuality={lowQuality} onSlow={reduceQuality} interaction={interaction} handleRaised={handleRaised} shadowLightRef={shadowLightRef} carryRef={carryRef} stageRef={stageRef} instrumentRef={instrumentRef} handleHitRef={handleHitRef} setHandleRaised={setHandleRaised} /> : null}
          </group>
          </Suspense>
        </Canvas>
        {spatialActive && presented && active ? (
          <svg className="scope-handle-hit">
            <path
              ref={handleHitRef}
              role="button"
              tabIndex={0}
              aria-label="Carry handle"
              aria-description="Click to fold or raise the handle. Drag to pick up and carry the scope."
              aria-pressed={handleRaised}
              onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary || !carryRef.current.api?.begin(event, handleRaised)) return
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => carryRef.current.api?.move(event)}
              onPointerUp={(event) => carryRef.current.api?.end(event.pointerId, false, event.timeStamp)}
              onPointerCancel={(event) => carryRef.current.api?.end(event.pointerId, true, event.timeStamp)}
              onLostPointerCapture={(event) => carryRef.current.api?.end(event.pointerId, true, event.timeStamp)}
              onDragStart={(event) => event.preventDefault()}
              onClick={(event) => {
                if (carryRef.current.drag) return
                if (carryRef.current.suppressClick && event.detail > 0) { carryRef.current.suppressClick = false; return }
                carryRef.current.suppressClick = false
                const wasRaised = carryRef.current.tapRaised
                carryRef.current.tapRaised = null
                setHandleRaised((raised) => wasRaised === null ? !raised : !wasRaised)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                if (!event.repeat && !carryRef.current.drag) setHandleRaised((raised) => !raised)
              }}
            />
          </svg>
        ) : null}
      </div>
    </MaterialBoundary>
  )
})
