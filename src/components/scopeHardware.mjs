// Carry-handle dimensions and its rounded physical profile.
export const HANDLE_HALF_SPAN = 0.245
export const HANDLE_REACH = 148
export const HANDLE_ARM_HALF = 15
export const HANDLE_GRIP_WIDTH = 38
export const HANDLE_THICKNESS = 28
export const HANDLE_EDGE_RADIUS = 7
export const HANDLE_PIVOT_LIFT = 12
export const HANDLE_PIVOT_Z = -71

export function carryHandleProfile(width, scale = 1) {
  const pivot = width * HANDLE_HALF_SPAN
  const outer = pivot + HANDLE_ARM_HALF * scale
  const inner = pivot - HANDLE_ARM_HALF * scale
  const front = HANDLE_PIVOT_Z * scale
  const back = front - HANDLE_REACH * scale
  const innerBack = back + HANDLE_GRIP_WIDTH * scale
  const shoulder = 30 * scale, innerShoulder = 38 * scale, root = HANDLE_ARM_HALF * scale
  return { back, innerBack, commands: [
    ['moveTo', -outer, front],
    ['lineTo', -outer, back + shoulder],
    ['quadraticCurveTo', -outer, back, -outer + shoulder, back],
    ['lineTo', outer - shoulder, back],
    ['quadraticCurveTo', outer, back, outer, back + shoulder],
    ['lineTo', outer, front],
    ['quadraticCurveTo', outer, front + root, pivot, front + root],
    ['quadraticCurveTo', inner, front + root, inner, front],
    ['lineTo', inner, innerBack + innerShoulder],
    ['quadraticCurveTo', inner, innerBack, inner - innerShoulder, innerBack],
    ['lineTo', -inner + innerShoulder, innerBack],
    ['quadraticCurveTo', -inner, innerBack, -inner, innerBack + innerShoulder],
    ['lineTo', -inner, front],
    ['quadraticCurveTo', -inner, front + root, -pivot, front + root],
    ['quadraticCurveTo', -outer, front + root, -outer, front],
    ['closePath'],
  ] }
}
