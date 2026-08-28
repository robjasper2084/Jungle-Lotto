# Performance — conversion v2

Local build and browser observations, 2026-08-28. These are unthrottled loopback measurements, not real-user Core Web Vitals, Lighthouse scores or production guarantees.

## Implemented

Static Astro HTML renders catalog, headings and product information. The GitHub Pages base path is preserved. Fonts remain local. Existing supplied assets, atlas imagery and videos are retained; no framework or runtime dependency was added for conversion v2.

The hero uses 640/960/1600/2048-width srcset candidates, sizes=100vw, explicit dimensions and high fetch priority. The original source is 2048px; it was not upscaled to an invented 2400px source.

| Hero source | Encoded file bytes |
|---|---:|
| 640 WebP, new | 9,778 |
| 960 WebP, existing | 18,618 |
| 1600 WebP, new | 36,710 |
| 2048 WebP, existing | 65,726 |

The Pixel 7 emulation selected 1600px because of its device-pixel ratio, not the largest 2048px file. The one-DPR width sweep also exercises narrower candidates.

No initial homepage request for the game engine, motion atlases, MP4, MP3 or Three/model/cathedral chunks was observed in the browser suite. Inline films and commercial popups attach their source only on request. Closing a commercial pauses playback, removes src and releases the media resource. Hidden-page playback pauses.

Supplied models remain preserved but unbound. The static hero status resolves immediately. Three.js remains a lazy enhancement, and static/reduced-motion/save-data modes avoid it. Optional 2.5D image display is labeled honestly.

The older cross-document view transition was removed after reproducible render-frame stalls during navigation. Normal browser launch flags now pass the navigation tests; no experimental workaround flag was added to project configuration.

## Local lab samples

Source: browser-release-check/store-visual-homepage-rend-9e38d-does-not-load-game-or-video-{project}/performance.json, under the QA evidence directory.

| Browser project | CSS width | LCP, ms | CLS | DOMContentLoaded, ms | Resource encoded-body bytes at sample |
|---|---:|---:|---:|---:|---:|
| Chromium desktop | 1440 | 196 | 0 | 52.1 | 1,258,431 |
| Chromium Pixel 7 emulation | 390 | 180 | 0 | 58.5 | 993,543 |
| Chromium wide | 1920 | 216 | 0 | 54.8 | 1,345,879 |
| WebKit tablet emulation | 768 | 280 | 0 | 208 | 601,767 |
| WebKit desktop | 1440 | 695 | 0 | 211 | 630,783 |

Resource sampling occurs near the first screenshot, not after downloading the whole site. Lazy-image timing, device ratio, browser cache behavior and API support differ, so these rows are not a controlled cross-browser benchmark. Samples preceded the final small drop-heading size adjustment; a final focused layout pass verified that adjustment.

## Remaining work and limits

- Build passes with the existing greater-than-500-kB lazy chunk warning. The warning is not resolved or suppressed.
- Run throttled deployed tests on constrained physical Android hardware before asserting LCP under 2.5s or CLS under 0.1 in production.
- No merchant latency, payment redirect, real subscription endpoint, production CDN/cache behavior, field telemetry or Lighthouse audit was tested.
- The original-game browser suite has two unresolved failures; see QA_REPORT.md. Passing storefront loading budgets does not certify every game path.
- npm ci was not run. Existing installed dependencies were reused; C: had less than 0.5GB free during final QA. Do not install/copy large trees without checking space.
- Full geometry viewers, final approved GLBs, context loss on real GPUs and production video accessibility remain future validation.

No deployment or production performance claim is included in this work.
