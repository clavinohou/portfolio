import { capturePostHogEvent } from './posthog.js'

// Only explicit, non-personal interaction metadata belongs in custom events.
const parameters = new Set([
  'portfolio_channel', 'project_id', 'contact_method', 'link_location',
  'view_mode', 'power_state', 'media_index',
  'scope_control', 'scope_channel', 'input_method', 'start_value', 'end_value', 'input_state',
])

export function trackEvent(name, details = {}) {
  if (typeof window === 'undefined') return
  const safeDetails = { page_path: window.location.pathname }
  for (const [key, value] of Object.entries(details)) {
    if (!parameters.has(key)) continue
    if (typeof value === 'string') safeDetails[key] = value.slice(0, 100)
    else if (typeof value === 'number' && Number.isFinite(value)) safeDetails[key] = value
  }
  try {
    window.gtag?.('event', name, safeDetails)
  } catch {
    // A failing GA4 tag must not interrupt the action or PostHog.
  }
  capturePostHogEvent(name, safeDetails)
}

// Batch wheel/keyboard bursts; pointer drags flush when released. Values are
// normalized to 0–100 so different controls can be compared in reports.
export function createAdjustmentTracker(control, channel) {
  let pending = null
  let timer = null
  const flush = () => {
    clearTimeout(timer)
    timer = null
    const adjustment = pending
    pending = null
    if (!adjustment || adjustment.start_value === adjustment.end_value) return
    trackEvent('scope_control_adjust', {
      scope_control: control, scope_channel: channel, ...adjustment,
    })
  }
  return {
    flush,
    record(start, end, method, defer = true) {
      if (start === end) return
      if (pending && pending.input_method !== method) flush()
      pending = {
        start_value: pending?.start_value ?? Math.round(start * 10000) / 100,
        end_value: Math.round(end * 10000) / 100,
        input_method: method,
      }
      clearTimeout(timer)
      if (defer) timer = setTimeout(flush, 500)
    },
  }
}
