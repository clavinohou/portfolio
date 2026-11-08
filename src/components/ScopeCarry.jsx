import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three'

const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10)

export function createScopeCarry() {
  return { offset: new Vector3(), drag: null, recovery: null, pose: null, drop: null, slide: null,
    air: null, shake: null, cameraShakeOffset: new Vector3(), api: null, pausedAt: null,
    finished: false, suppressClick: false, tapRaised: null, phase: 'idle' }
}

export function useScopeCarry({ carryRef, stageRef, instrumentRef, handleHitRef, shadowLightRef, interaction, motion, active, setHandleRaised }) {
  const { camera, get, gl, invalidate } = useThree()
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  useLayoutEffect(() => {
    const carry = carryRef.current
    const unlock = () => {
      const pause = carry.pausedAt === null ? 0 : performance.now() - carry.pausedAt
      const state = motion.current
      if (state.transition?.start != null) state.transition.start += pause
      if (state.presentationStart !== null) state.presentationStart += pause
      carry.pose = carry.recovery = null
      carry.pausedAt = null
      carry.finished = false
      invalidate()
    }
    const begin = (event, wasRaised) => {
      if (carry.drag || !stageRef.current || !instrumentRef.current) return false
      const { size } = get()
      const origin = new Vector3(0, 0, 0).unproject(camera)
      const alreadyMoving = Boolean(carry.drop || carry.slide || instrumentRef.current.position.y > 0.001)
      carry.pose = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), zoom: camera.zoom,
        origin: carry.offset.clone(), framing: motion.current.handleFraming,
        orbitX: motion.current.orbitX, orbitY: motion.current.orbitY }
      carry.followOrbitX = motion.current.orbitX
      carry.followOrbitY = motion.current.orbitY
      carry.followCursor = true
      carry.shake = null
      carry.tapRaised = wasRaised
      setHandleRaised(true)
      carry.pausedAt ??= performance.now()
      carry.recovery = carry.drop = carry.slide = null
      carry.finished = carry.suppressClick = false
      carry.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, started: event.timeStamp, moved: false, alreadyMoving,
        position: stageRef.current.position.clone(), bodyY: instrumentRef.current.position.y,
        right: new Vector3(2 / size.width, 0, 0).unproject(camera).sub(origin),
        down: new Vector3(0, -2 / size.height, 0).unproject(camera).sub(origin),
        delta: new Vector3(), velocity: new Vector3(), lastDelta: new Vector3(), lastMove: event.timeStamp, pickup: 0 }
      motion.current.x = motion.current.orbitX / 1100
      motion.current.y = (motion.current.orbitY - 220) / 420
      interaction.current = true
      document.documentElement.classList.add('scope-is-carrying')
      invalidate()
      return true
    }
    const move = (event) => {
      const drag = carry.drag
      if (!drag || drag.id !== event.pointerId) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 4) return
      drag.moved = true
      const now = event.timeStamp, seconds = Math.max(0.008, Math.min(0.08, (now - drag.lastMove) / 1000))
      const zoomScale = carry.pose.zoom / camera.zoom
      drag.delta.copy(drag.right).multiplyScalar(dx * zoomScale).addScaledVector(drag.down, dy * zoomScale)
      const velocity = drag.delta.clone().sub(drag.lastDelta).divideScalar(seconds).clampLength(0, 1800)
      drag.velocity.lerp(velocity, 0.4)
      drag.lastDelta.copy(drag.delta)
      drag.lastMove = now
      stageRef.current.position.set(drag.position.x + drag.delta.x, 0, drag.position.z + drag.delta.z)
      invalidate()
    }
    const end = (pointerId = null, cancelled = false, releasedAt = performance.now()) => {
      const drag = carry.drag
      if (!drag || (pointerId !== null && drag.id !== pointerId)) return
      const placed = drag.moved || drag.alreadyMoving || releasedAt - drag.started >= 220 || cancelled
      carry.followCursor = placed
      carry.drag = null
      carry.suppressClick = placed
      interaction.current = false
      document.documentElement.classList.remove('scope-is-carrying')
      const path = handleHitRef.current
      if (path?.hasPointerCapture(drag.id)) path.releasePointerCapture(drag.id)
      const from = instrumentRef.current.position.y
      carry.releaseZoom = camera.zoom
      if (placed) {
        carry.tapRaised = null
        setHandleRaised(false)
        // A pause before release removes momentum; a fresh gesture preserves it.
        const age = Math.max(0, releasedAt - drag.lastMove)
        const velocity = drag.velocity.clone().multiplyScalar(cancelled || age > 250 ? 0 : Math.exp(-age / 90))
        if (reduced.matches) velocity.set(0, 0, 0)
        const horizontal = new Vector3(velocity.x, 0, velocity.z).clampLength(0, 750)
        const speed = horizontal.length(), vy = Math.max(-1000, Math.min(180, velocity.y)), gravity = 4800
        carry.slide = speed > 35 ? { velocity: horizontal, skips: speed > 600 ? 1 : 0, bounces: 0 } : null
        const duration = Math.max(0.08, (vy + Math.sqrt(vy * vy + 2 * gravity * Math.max(0, from))) / gravity)
        carry.drop = { from, vy, gravity, duration, elapsed: 0, phase: 'fall', strength: Math.min(1, 0.55 + from / 200 + speed / 1800) }
        carry.recovery = { from: carry.offset.clone(), to: stageRef.current.position.clone(),
          elapsed: 0, duration: 0.6, hold: 0.14 }
      } else {
        carry.drop = from === drag.bodyY ? null : { from, to: drag.bodyY, duration: 0.12, elapsed: 0, phase: 'return' }
        // A tap can finish mid-pickup; ease its framing back instead of
        // snapping from the grab zoom into the manually selected handle pose.
        carry.recovery = { from: carry.offset.clone(), to: stageRef.current.position.clone(), elapsed: 0, duration: 0.3 }
      }
      invalidate()
    }
    const api = { begin, move, end, unlock }
    carry.api = api
    return () => {
      carry.drag = carry.recovery = carry.pose = carry.drop = carry.slide = carry.air = carry.shake = null
      carry.pausedAt = null
      carry.api = null
      interaction.current = false
      document.documentElement.classList.remove('scope-is-carrying')
    }
  }, [camera, get, invalidate, carryRef, stageRef, instrumentRef, handleHitRef, interaction, motion, setHandleRaised, reduced])
  useEffect(() => {
    if (!active) carryRef.current.api?.end(null, true)
    else invalidate()
  }, [active, carryRef, invalidate])
  useFrame((_, delta) => {
    if (!active || !instrumentRef.current) return
    const carry = carryRef.current, body = instrumentRef.current
    const step = Math.min(delta, 0.04)
    const previousY = body.position.y
    if (carry.slide) {
      const slide = carry.slide, airborne = carry.drop?.phase === 'fall'
      stageRef.current.position.addScaledVector(slide.velocity, step)
      slide.velocity.multiplyScalar(Math.exp(-(airborne ? 0.9 : 12) * step))
      if (!airborne && slide.velocity.length() < 12) carry.slide = null
    }
    if (carry.drag) {
      const drag = carry.drag
      drag.pickup = reduced.matches ? 1 : Math.min(1, drag.pickup + step / 0.12)
      body.position.y = Math.max(0, drag.bodyY + drag.delta.y + 14 * (reduced.matches ? 1 : ease(drag.pickup)))
      if (drag.pickup < 1) invalidate()
    }
    if (carry.drop) {
      const drop = carry.drop
      drop.elapsed += step
      const t = reduced.matches ? 1 : Math.min(1, drop.elapsed / drop.duration)
      if (drop.phase === 'return') {
        body.position.y = drop.from + (drop.to - drop.from) * ease(t)
        if (t === 1) carry.drop = null
      } else if (drop.phase === 'fall') {
        body.position.y = Math.max(0, drop.from + drop.vy * drop.elapsed - 0.5 * drop.gravity * drop.elapsed ** 2)
        if (t === 1) {
          body.position.y = 0
          carry.air = reduced.matches ? null : { elapsed: 0, strength: drop.strength, origin: stageRef.current.position.clone() }
          carry.shake = reduced.matches ? null : { elapsed: 0, strength: drop.strength }
          const speed = carry.slide?.velocity.length() || 0
          if (!reduced.matches && speed > 400 && carry.slide.skips > 0) {
            const slide = carry.slide
            const vy = Math.min(145, 85 + speed * 0.08)
            slide.skips -= 1
            slide.bounces += 1
            slide.velocity.multiplyScalar(0.48)
            carry.drop = { ...drop, from: 0, vy, duration: 2 * vy / drop.gravity, elapsed: 0, strength: drop.strength * 0.7 }
          } else carry.drop = { ...drop, phase: 'settle', duration: 0.16, elapsed: 0 }
        }
      } else {
        // Rubber feet compress briefly; the rigid case settles with one small rebound.
        body.position.y = reduced.matches ? 0 : drop.strength * (t < 0.35
          ? -2 * Math.sin(Math.PI * t / 0.35)
          : 2.5 * Math.sin(Math.PI * (t - 0.35) / 0.65) * Math.exp(-2 * (t - 0.35) / 0.65))
        if (t === 1) { body.position.y = 0; carry.drop = null }
      }
      invalidate()
    }
    if (carry.recovery) {
      const recovery = carry.recovery
      recovery.to.copy(stageRef.current.position)
      // Let the landing read at its new location before following it.
      if (!carry.drop && !carry.slide && (recovery.hold || 0) > 0) recovery.hold = Math.max(0, recovery.hold - step)
      else if (!carry.drop && !carry.slide) recovery.elapsed += step
      const t = reduced.matches ? 1 : Math.min(1, recovery.elapsed / recovery.duration)
      recovery.progress = ease(t)
      carry.offset.lerpVectors(recovery.from, recovery.to, recovery.progress)
      carry.finished = t === 1 && !carry.drop && !carry.slide
      invalidate()
    }
    if (carry.air) {
      carry.air.elapsed += step
      if (carry.air.elapsed >= 0.46) carry.air = null
      invalidate()
    }
    if (carry.shake) {
      carry.shake.elapsed += step
      if (carry.shake.elapsed >= 0.28) carry.shake = null
      invalidate()
    }
    if (body.position.y !== previousY) {
      if (shadowLightRef.current) shadowLightRef.current.shadow.needsUpdate = true
      gl.shadowMap.needsUpdate = true
    }
    carry.phase = carry.drag ? (carry.drag.pickup < 1 ? 'pickup' : 'held')
      : carry.drop ? carry.drop.phase === 'fall' ? 'placing' : 'settling'
        : carry.slide ? 'skidding' : carry.recovery ? 'recentering' : 'idle'
    if (handleHitRef.current) handleHitRef.current.dataset.carryState = carry.phase
  }, -2)
}

export function CarryAir({ carryRef, fit, stageRef }) {
  const group = useRef(null)
  const particles = useRef([])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')
    for (const [x, y, radius] of [[24, 34, 24], [41, 33, 20], [32, 23, 19]]) {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, '#fcfcfdee')
      gradient.addColorStop(0.55, '#b4b8bcab')
      gradient.addColorStop(1, '#b4b8bc00')
      context.fillStyle = gradient
      context.fillRect(0, 0, 64, 64)
    }
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(() => {
    const air = carryRef.current.air
    group.current.visible = Boolean(air)
    if (!air) return
    for (let index = 0; index < 6; index += 1) {
      const particle = particles.current[index], side = index < 3 ? -1 : 1
      const t = Math.max(0, Math.min(1, (air.elapsed - index % 3 * 0.022) / 0.4))
      particle.position.set(air.origin.x - stageRef.current.position.x + side * (fit.width * 0.47 + (20 + 150 * t) * fit.scale),
        -fit.height / 2 - 10 * fit.scale + Math.sin(Math.PI * t) * 10 * fit.scale,
        air.origin.z - stageRef.current.position.z + (18 + index % 3 * 10) * fit.scale)
      particle.scale.set((36 + 90 * t) * fit.scale, (26 + 50 * t) * fit.scale, 1)
      particle.material.opacity = air.strength * (1 - t) ** 1.1
    }
  })
  return <group ref={group} name="scope-landing-air">
    {Array.from({ length: 6 }, (_, index) => <sprite key={index} ref={(node) => { particles.current[index] = node }}>
      <spriteMaterial map={texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </sprite>)}
  </group>
}
