# Portfolio analytics

GA4 loads only for production builds on `calvinhou.com` when
`VITE_GA4_MEASUREMENT_ID` is configured. Local previews send nothing to GA4.

## Custom events

| Event | Trigger / details |
| --- | --- |
| `portfolio_channel_select` | A different section opens; `portfolio_channel` |
| `portfolio_home_return` | Return from a section to the scope; `portfolio_channel` |
| `resume_download` | Résumé download link clicked (does not confirm a completed download) |
| `resume_open` | Résumé “open in new tab” link clicked |
| `contact_click` | Email or social link clicked; `contact_method`, `link_location` where provided |
| `contact_email_compose` | Valid contact form opens an email draft; no confirmation of sending |
| `build_log_open` | Internal link to the build log clicked |
| `project_open` | Internal project or external project link clicked; `project_id`, `link_location` |
| `scope_control_adjust` | Knob or trigger marker changed; `scope_control`, `scope_channel`, `input_method`, `start_value`, `end_value` (normalized percent) |
| `scope_channel_select` | A different waveform channel selected; `scope_channel` |
| `scope_input_toggle` | Waveform rocker toggled; `scope_channel`, `input_state` |
| `scope_view_change` | Accepted switch between 2D and 3D; `view_mode` |
| `scope_power_toggle` | Accepted power toggle; target `power_state` |
| `media_open` | Carousel lightbox opened; one-based `media_index` |
| `pcb_viewer_open` | Interactive PCB viewer opened |
| `workbook_open` | In-page spreadsheet preview opened |

Knob drags emit once on release; wheel and keyboard bursts emit after 500 ms
of inactivity. No-op changes and gestures returning to their starting value are
ignored. Pending adjustments flush when their control unmounts or changes channel.

Every custom event includes the current `page_path`, excluding query/hash data.
Events fire in explicit action handlers, not mount effects, to avoid StrictMode
mount duplication. A missing or failing analytics tag must not block an action.
Custom metadata is allowlisted in `src/lib/analytics.js`; do not pass names,
addresses, messages, form values, or mailto URLs with draft contents.
Interactions inside PDF previews and third-party PCB iframes are not measured.

## Google Analytics dashboard setup after deployment

1. Under Admin → Data streams → web stream → Enhanced measurement, verify
   outbound clicks, file downloads, and page views/history changes are enabled.
   Do not add a second manual page-view implementation alongside history tracking.
2. Under Admin → Custom definitions, create **event-scoped** custom dimensions
   using these exact parameter names: `portfolio_channel`, `project_id`,
   `contact_method`, `link_location`, `view_mode`, `power_state`, `scope_control`,
   `scope_channel`, `input_method`, and `input_state`.
   `media_index` can stay a debugging detail unless a report needs it.
3. Under Admin → Events, mark `resume_download` and `contact_email_compose` as
   key events if these are the desired outcomes. Decide separately whether
   social-profile clicks deserve key-event status.
4. After deployment, test clicks on the live site and verify event names and
   parameters in Realtime. DebugView requires debug mode (for example through
   Google's Analytics Debugger). Normal reporting can take 24–48 hours.

Enhanced measurement may also record `file_download` or outbound `click` for the
same action as a descriptive custom event. Do not sum both as independent actions
or mark both résumé event types as key events.

References:
- [Enhanced measurement](https://support.google.com/analytics/answer/9216061)
- [Event parameters and custom dimensions](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
- [Custom events and reporting](https://support.google.com/analytics/answer/12229021)

Run regression checks with `npm run test:analytics`. Browser QA uses a local
`window.gtag` stub so test interactions do not enter the production property.
