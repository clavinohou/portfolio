const projectToken = import.meta.env?.VITE_POSTHOG_PROJECT_TOKEN?.trim()
const apiHost = import.meta.env?.VITE_POSTHOG_HOST?.trim()
const cloudHosts = new Set(['https://us.i.posthog.com', 'https://eu.i.posthog.com'])

let postHogReady

function stripUrlParameters(url) {
  return url.split(/[?#]/, 1)[0]
}

function sanitizeEvent(event) {
  for (const properties of [event.properties, event.$set, event.$set_once]) {
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (typeof value === 'string' && /(?:_url|referrer)$/.test(key)) {
        properties[key] = stripUrlParameters(value)
      }
    }
  }
  return event
}

function postHogAllowed() {
  return Boolean(import.meta.env?.PROD) && typeof window !== 'undefined' &&
    window.location.hostname === 'calvinhou.com' &&
    /^phc_[a-zA-Z0-9]+$/.test(projectToken ?? '') && cloudHosts.has(apiHost)
}

// Canvas frames are most of a replay's upload, and capturing them reads the
// WebGL buffer back from the GPU. Only desktop-class devices that the scope
// renders at full quality, on a link the browser doesn't report as slow or
// data-saving, pay that cost; everyone else gets the DOM-only replay.
export function canvasReplayAllowed() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const connection = navigator.connection
  // `downlink` is left out: at page start it is a coarse guess that read
  // ~1.5 Mbps even on fast broadband in testing.
  if (connection?.saveData || /2g|3g/.test(connection?.effectiveType ?? '')) return false
  if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) return false
  return window.matchMedia?.('(pointer: fine)').matches ?? false
}

// Decided once per page so the WebGL canvas and the recorder agree.
let canvasRecording
export function recordsCanvas() {
  canvasRecording ??= postHogAllowed() && canvasReplayAllowed()
  return canvasRecording
}

// The recorder ships in the same chunk as the SDK. Otherwise the SDK fetches it
// from PostHog's asset host after start-up, and blockers often stop that file
// while letting events through, which leaves sessions with no recording.
export function loadPostHogSdk() {
  return Promise.all([import('posthog-js'), import('posthog-js/dist/posthog-recorder')])
    .then(([{ default: posthog }]) => posthog)
}

export function postHogOptions() {
  return {
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    respect_dnt: true,
    autocapture: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_pageview: 'history_change',
    capture_performance: false,
    save_campaign_params: false,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_capture_url_hashes: true,
    enable_recording_console_log: false,
    before_send: sanitizeEvent,
    session_recording: {
      blockSelector: 'form, input[type="file"]',
      maskAllInputs: true,
      recordHeaders: false,
      recordBody: false,
      recordCrossOriginIframes: false,
      // The scope body is a WebGL canvas; without frame capture it replays as
      // an empty box. Frames are only sent while the scene changes (measured at
      // 7–13 KB each, roughly +350 KB per minute of active 3D use).
      captureCanvas: recordsCanvas()
        ? { recordCanvas: true, canvasFps: 8, canvasQuality: '0.6' }
        : { recordCanvas: false },
      canvasCapture: { resolutionScale: 0.8 },
      maskCapturedNetworkRequestFn: (request) => request.name
        ? { ...request, name: stripUrlParameters(request.name) }
        : request,
    },
  }
}

export function startPostHog() {
  if (postHogReady || !postHogAllowed()) return

  postHogReady = loadPostHogSdk().then((posthog) => {
    posthog.init(projectToken, { api_host: apiHost, ...postHogOptions() })
    return posthog
  }).catch(() => {
    // The portfolio remains usable if the SDK cannot load.
  })
}

export function capturePostHogEvent(name, details) {
  postHogReady?.then((posthog) => posthog?.capture(name, details)).catch(() => {
    // Analytics must not interrupt the site interaction.
  })
}
