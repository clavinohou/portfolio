import { CRT_CORNER_X, CRT_CORNER_Y } from './crtSurface.mjs'

// One finish for the HTML panel and the WebGL front face.
export const PANEL_SURFACE = {
  grain: '/materials/satin-grain.svg',
  grainSize: 180,
  angle: 115,
  stops: [[0, '#e5e6e2'], [0.38, '#d8dad5'], [1, '#c6c9c2']],
}

export const PANEL_SURFACE_CSS = `url('${PANEL_SURFACE.grain}') 0 0 / ${PANEL_SURFACE.grainSize}px ${PANEL_SURFACE.grainSize}px, linear-gradient(${PANEL_SURFACE.angle}deg, ${PANEL_SURFACE.stops.map(([at, color]) => `${color} ${at * 100}%`).join(', ')})`
export const BEZEL_RADIUS_X = 22
export const BEZEL_RADIUS_Y = 19

function roundedPath(x, y, w, h, rx, ry) {
  return `M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`
}

function maskImage(w, h, path) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill="white" fill-rule="evenodd" d="${path}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function panelFaceMask(fit, bezel, paddingX = 0, paddingY = 0) {
  const { width, height, scale } = fit
  const w = width / scale + 2 * paddingX, h = height / scale + 2 * paddingY
  const x = (width / 2 + bezel.x - bezel.width / 2) / scale + paddingX
  const y = (height / 2 - bezel.y - bezel.height / 2) / scale + paddingY
  const bw = bezel.width / scale, bh = bezel.height / scale
  // Leave the CRT opening clear so the faceplate cannot cover the bezel
  // while its material is handed to the already-opaque WebGL layer.
  const hole = roundedPath(x, y, bw, bh, BEZEL_RADIUS_X, BEZEL_RADIUS_Y)
  return maskImage(w, h, `M0 0H${w}V${h}H0Z ${hole}`)
}

export function bezelFaceMask(scale, bezel, glass) {
  const w = bezel.width / scale, h = bezel.height / scale
  const x = (glass.x - glass.width / 2 - bezel.x + bezel.width / 2) / scale
  const y = (bezel.y + bezel.height / 2 - glass.y - glass.height / 2) / scale
  const gw = glass.width / scale, gh = glass.height / scale
  return maskImage(w, h, `${roundedPath(0, 0, w, h, BEZEL_RADIUS_X, BEZEL_RADIUS_Y)} ${roundedPath(x, y, gw, gh, gw * CRT_CORNER_X, gh * CRT_CORNER_Y)}`)
}
