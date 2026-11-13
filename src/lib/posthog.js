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

export function startPostHog() {
  if (postHogReady || !import.meta.env?.PROD || typeof window === 'undefined' ||
    window.location.hostname !== 'calvinhou.com' ||
    !/^phc_[a-zA-Z0-9]+$/.test(projectToken ?? '') || !cloudHosts.has(apiHost)) return

  postHogReady = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(projectToken, {
      api_host: apiHost,
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
        maskCapturedNetworkRequestFn: (request) => request.name
          ? { ...request, name: stripUrlParameters(request.name) }
          : request,
      },
    })
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
