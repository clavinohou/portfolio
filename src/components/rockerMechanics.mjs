// Shared dimensions keep the CSS cap, printed face, and 3D solid aligned.
export const ROCKER_HEIGHT = 78
export const ROCKER_INSET = 1.5
export const ROCKER_THICKNESS = 6
export const ROCKER_BODY_DEPTH = 9
export const ROCKER_BEVEL = 0.6
export const ROCKER_FACE_DEPTH = ROCKER_THICKNESS / 2
export const ROCKER_TILT = Math.PI / 18
export const ROCKER_FLAT_SHEAR = 0.32

// The centered underside has tapered ends and a short, full-depth pivot area.
export function rockerSideProfile(height, scale = 1) {
  const halfLength = (height - 2 * ROCKER_INSET * scale) / 2
  const face = ROCKER_THICKNESS * scale / 2
  return [
    [-halfLength, face], [halfLength, face],
    [halfLength, -face], [halfLength * 0.24, -ROCKER_BODY_DEPTH * scale],
    [-halfLength * 0.24, -ROCKER_BODY_DEPTH * scale], [-halfLength, -face],
  ]
}

export function rockerPivotHeight(height, scale = 1) {
  const bottom = Math.min(...rockerSideProfile(height, scale).map(([y, z]) =>
    z * Math.cos(ROCKER_TILT) - Math.abs(y) * Math.sin(ROCKER_TILT),
  ))
  // Include the rounded machining edge in the clearance at either stop.
  return -bottom + (0.8 + Math.SQRT2 * ROCKER_BEVEL) * scale
}
