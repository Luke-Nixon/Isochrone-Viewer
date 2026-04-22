<div align="center">

# 🗺️ Isochrone Viewer

**Generate travel-time polygons. Visualise them instantly. Find the fairest meeting point. Export directly to Rightmove.**

[![Deploy](https://github.com/Luke-Nixon/Isochrone-Viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/Luke-Nixon/Isochrone-Viewer/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?logo=github)](https://luke-nixon.github.io/Isochrone-Viewer/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![MUI](https://img.shields.io/badge/MUI-7-007FFF?logo=mui&logoColor=white)](https://mui.com)
[![Tests](https://img.shields.io/badge/Tests-45%20passing-brightgreen)](#testing)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

<br />

[**→ Open Live App**](https://luke-nixon.github.io/Isochrone-Viewer/) &nbsp;·&nbsp; [Report Bug](https://github.com/Luke-Nixon/Isochrone-Viewer/issues) &nbsp;·&nbsp; [Request Feature](https://github.com/Luke-Nixon/Isochrone-Viewer/issues)

</div>

---

## What is this?

A browser-based tool with two complementary pages:

- **Isochrone** — *"Where can I reach within X minutes?"* Enter an address, pick a travel time and mode, get an accurate polygon of your reachable area, then one-click export to a Rightmove property search URL.
- **Meeting Point** — *"Where's the fairest place for everyone to meet?"* Enter N addresses, pick a fairness algorithm, and the app computes a meeting point that everyone can reach — with 6 different mathematical definitions of "fair" to choose from.

No backend. No account required. No API key needed for the default provider.

---

## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | **Isochrone** | Single-address travel-time polygon + Rightmove export |
| `/meet` | **Meeting Point** | Multi-person fair meeting point with 6 fairness modes |

A floating glass nav at the top switches between them. Both share provider config (localStorage), the animated WebGL background, and the dark glassmorphic theme.

---

## Features

### Isochrone page
| | Feature |
|---|---|
| 🔍 | **UK address search** — powered by Nominatim with real-time autocomplete |
| 🕐 | **Travel time slider** — 1 minute to 5 hours in fine-grained increments |
| 🚗 | **Travel modes** — driving, walking, cycling, and transit |
| 📍 | **Live polygon overlay** — isochrone and Rightmove export polygon both rendered on the map |
| 🔗 | **Rightmove export** — one-click open or copy, with adaptive polygon simplification |

### Meeting Point page
| | Feature |
|---|---|
| 👥 | **N people, individual modes** — each person gets their own travel mode + optional weight |
| ⚖️ | **6 fairness algorithms** — minimax, leximin, utilitarian, equal-effort, Nash bargaining, Pareto |
| 📍 | **Reverse-geocoded result** — meeting point shown as nearest postcode + locality |
| 🎯 | **Pareto interactive picker** — when in Pareto mode, click any alternate on the map to inspect its trade-offs |
| 📊 | **Per-person + aggregate stats** — actual travel time per person, plus worst/mean/total/variance; weighted figures shown when weights are on |
| 🛡️ | **Graceful fallback** — when the public Valhalla server can't compute the largest contours, those are dropped and the algorithm runs on whatever succeeded; user is notified of the reduced coverage |
| 💾 | **Persistent state** — people, mode, weights, max travel time all saved to localStorage |

### Across both pages
| | Feature |
|---|---|
| 🗺️ | **Interactive map** — React-Leaflet with dark/light theme toggle |
| ⚡ | **Zero backend** — fully static, deployable to GitHub Pages |
| 🌌 | **WebGL animated background** — procedural "Universe Within" shader |

---

## Fair Meeting Point — the algorithms

Each algorithm picks a *different* point depending on its definition of "fair". They diverge most on asymmetric setups (e.g. 3 people clustered in one city + 1 outlier).

| Mode | Optimises | Best when |
|---|---|---|
| **Minimax** *(egalitarian)* | Minimise the *worst* travel time | Nobody should travel more than necessary; the bottleneck person matters most |
| **Leximin** | Minimise worst, then second-worst, then third-worst… | Strict refinement of minimax; breaks ties more rigorously |
| **Utilitarian** | Minimise the *total* travel time | Best aggregate efficiency; one person may travel further if it saves several others a lot |
| **Equal-effort** *(min-variance)* | Minimise variance — everyone travels roughly the same time | "Nobody can complain — we all suffered equally" |
| **Nash bargaining** | Minimise Σ log(time) — geometric mean | Principled middle ground between fair and efficient |
| **Pareto-optimal set** | Returns *all* non-dominated points | When you want to see the trade-off curve and pick the answer yourself |

**Optional per-person weights** — give one person priority (e.g. host, mobility-impaired). Weights apply uniformly across whichever mode is active.

**How it works under the hood** (no matrix API needed):
1. Multi-contour isochrone request per person via Valhalla (e.g., `[5, 10, 15, …, 60, 75, 90]` minutes in one ladder)
2. Server-side polygon simplification (`generalize: 50`, `denoise: 0.5`) to keep payloads small
3. **Bucketed time lookup**: for any candidate point, find the smallest band that contains it — that's the person's travel time, quantised to the band step
4. Algorithm-specific scoring + brute-force-search across a 30×30 grid inside the reachable intersection
5. Reliability layer: 3 retries with jittered backoff, single-contour requests for big isochrones, recursive split-on-failure, in-memory cache, graceful contour-drop fallback

---

## Quick Start

```bash
# Clone
git clone https://github.com/Luke-Nixon/Isochrone-Viewer.git
cd Isochrone-Viewer

# Install
npm install

# Run locally
npm run dev
```

Open `http://localhost:5173` and you're good to go.

---

## Tech Stack

<table>
  <tr>
    <td><strong>UI Framework</strong></td>
    <td>React 19 + TypeScript 5.9</td>
  </tr>
  <tr>
    <td><strong>Build Tool</strong></td>
    <td>Vite 8</td>
  </tr>
  <tr>
    <td><strong>Component Library</strong></td>
    <td>Material UI v7 with glassmorphic dark theme</td>
  </tr>
  <tr>
    <td><strong>Routing</strong></td>
    <td>React Router 7 (HashRouter — works on any static host)</td>
  </tr>
  <tr>
    <td><strong>Map</strong></td>
    <td>React-Leaflet — CartoDB Dark Matter / OpenStreetMap tiles</td>
  </tr>
  <tr>
    <td><strong>Geometry</strong></td>
    <td>Turf.js (intersect, centroid, area, bbox, point-in-polygon)</td>
  </tr>
  <tr>
    <td><strong>Isochrone API</strong></td>
    <td>Valhalla (public OSM instance — no key required)</td>
  </tr>
  <tr>
    <td><strong>Geocoding</strong></td>
    <td>Nominatim (OpenStreetMap) — forward + reverse</td>
  </tr>
  <tr>
    <td><strong>Schema Validation</strong></td>
    <td>Zod</td>
  </tr>
  <tr>
    <td><strong>Testing</strong></td>
    <td>Vitest — 45 tests (property + golden, with real captured Valhalla fixtures)</td>
  </tr>
  <tr>
    <td><strong>Hosting</strong></td>
    <td>GitHub Pages via GitHub Actions</td>
  </tr>
</table>

---

## Architecture

```
src/
├── pages/
│   ├── Isochrone/        # Single-address isochrone page (route: /)
│   └── Meet/             # Multi-person meeting point page (route: /meet)
├── components/
│   ├── AppNav/           # Glass nav chip switching between pages
│   ├── AnimatedBackground/  # WebGL fullscreen procedural background
│   ├── MapView/          # Generic prop-driven Leaflet map (markers, polygons, focus)
│   ├── SearchParameters/ # Address search, travel time/mode (Isochrone page)
│   ├── ProviderConfig/   # Per-provider config tabs (Valhalla, Mapbox, OpenRoute)
│   ├── GeoExport/        # Rightmove URL builder, polygon encoder, copy/open
│   └── MeetingPoint/     # All Meet-page UI:
│       ├── PeopleList/, PersonRow/    # Add/remove people, geocode, set mode + weight
│       ├── ModeSelector/              # Pick one of 6 fairness algorithms
│       ├── MaxTime/                   # Travel-time slider with reliability warning
│       ├── ProviderStatus/            # Quick-enable Valhalla without leaving the page
│       ├── ResultsPanel/              # Coords, address, stats, Pareto-front picker
│       └── MeetMapView/               # Builds spec arrays for generic MapView
├── services/
│   ├── GeocodingService/    # Nominatim search + reverse + autocomplete hook
│   ├── IsochroneService/    # Valhalla API client + provider config storage
│   └── MeetingPointService/ # Multi-person fairness solver
│       ├── algorithms/      # One file per mode (minimax, leximin, utilitarian, …)
│       ├── shared/          # buildResult, scoring fns, weights, stats
│       ├── geometry.ts      # Turf wrappers
│       ├── sampling.ts      # Candidate grid + getTimeAt
│       ├── provider.ts      # IsochroneProvider abstraction + Valhalla adapter
│       └── __tests__/       # 45 tests + 4 captured Valhalla fixtures
└── theme.ts                 # MUI glassmorphic dark theme
```

**Isochrone data flow:**
```
Address → Nominatim → [lat, lng] → Valhalla /isochrone → GeoJSON → Map + Rightmove URL
```

**Meeting Point data flow:**
```
N addresses ─► Nominatim geocode ─► N × Valhalla /isochrone (multi-contour, paced, retried)
                                              │
                                              ▼
                                         PersonBands[]
                                              │
                                  ┌───────────┴───────────┐
                                  │ minimax / leximin     │
                                  │ utilitarian / variance│ ── pick optimum ──► Candidate
                                  │ nash / pareto         │                       │
                                  └───────────────────────┘                       ▼
                                                                          Map + per-person stats
                                                                          + reverse geocode
```

---

## Rightmove Export

The export pipeline converts the Valhalla GeoJSON polygon into a format Rightmove's map search accepts:

1. Extract the outer ring from the `Polygon` or `MultiPolygon[0][0]`
2. Encode as [Google Encoded Polyline](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) (precision 1e-5)
3. Wrap as `USERDEFINEDAREA^{"polylines":"<encoded>"}`
4. `encodeURIComponent` + explicit `~` → `%7E` substitution
5. **Adaptive simplification** — binary search finds the maximum polygon complexity that keeps the URL within Rightmove's length limit

---

## Providers

| Provider | Status | API Key | Notes |
|---|---|---|---|
| **Valhalla** | ✅ Implemented | Not required | Defaults to `valhalla1.openstreetmap.de`. Public instance reliable up to ~75 min travel time; above that the slider shows a warning. Self-hosted Valhalla URL works for higher. |
| **Mapbox** | 🚧 Coming soon | Required | — |
| **OpenRouteService** | 🚧 Coming soon | Required | — |

---

## Testing

The Meeting Point algorithms are covered by two complementary test suites:

| Suite | What it does |
|---|---|
| **Property tests** ([algorithms.test.ts](src/services/MeetingPointService/__tests__/algorithms.test.ts)) | Synthetic concentric-square bands; verifies each algorithm finds its own optimum vs brute-force enumeration |
| **Golden tests** ([golden.test.ts](src/services/MeetingPointService/__tests__/golden.test.ts)) | Real Valhalla bands captured for 4 known scenarios; expected outputs hand-verified geographically; locks in answers as a regression catch |

```bash
npm test              # Run all tests (~5s)
npm run test:watch    # Watch mode
npm run test:capture  # Re-fetch golden fixtures from public Valhalla (~38s, occasional)
```

The 4 golden scenarios live in [`__tests__/fixtures/`](src/services/MeetingPointService/__tests__/fixtures/) — committed JSON, ~3 MB total. To refresh after a Valhalla data change, run `npm run test:capture` then flip the [`golden-preview.test.ts`](src/services/MeetingPointService/__tests__/golden-preview.test.ts) `describe.skip` to `describe.only` to print the new outputs for hand-verification before locking them in.

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via GitHub Actions.

To deploy your own fork:

1. Fork the repository
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. Push to `main` — the workflow handles the rest

```yaml
# .github/workflows/deploy.yml — runs on every push to main
npm ci → npm run build → upload dist/ → deploy to Pages
```

The app uses `HashRouter` and Vite's `base: './'` config — works on any static host without server-side URL rewrites.

---

## Local Development

```bash
npm run dev           # Start dev server at localhost:5173
npm run build         # Production build → dist/
npm run preview       # Preview production build locally
npm run lint          # ESLint
npm test              # Run test suite
npm run test:watch    # Tests in watch mode
npm run test:capture  # Refresh Valhalla fixtures (occasional)
```

---

## Limitations & future work

The Meeting Point page is genuinely useful, but it sits on top of a public OSS routing service that wasn't built for the load big multi-person isochrones generate. Worth understanding:

### Why it can be flaky on the public Valhalla instance

- **Compute time scales with isochrone area.** A 100-min driving isochrone from a London-area postcode covers half of England — the routing graph expansion takes seconds and often hits the gateway timeout (504).
- **No async job API.** Valhalla is request/response only. There's no way to say "this is a complex query, take longer" or to poll for a result. If the gateway times out, the response is lost regardless of whether the backend eventually finished.
- **Strips CORS headers on errors.** When the public instance returns a 5xx, the proxy strips `Access-Control-Allow-Origin`, so the browser surfaces a misleading CORS error instead of the underlying status code.
- **Community-hosted = shared.** `valhalla1.openstreetmap.de` is a free service that gets rate-limited under any non-trivial load.

What this app does about it (mitigations, not fixes):

| Layer | Mitigation |
|---|---|
| **Request shape** | Smart ladder (5-min steps under 60, 15-min above), single-contour requests for >60 min, `generalize: 50` server-side simplification, in-memory band cache |
| **Retry** | 3 attempts with jittered exponential backoff on 429/5xx/network errors |
| **Failure tolerance** | Recursive split-on-failure for batched chunks; graceful contour-drop (algorithm runs on whatever bands succeeded, user notified of reduced coverage) |
| **UI honesty** | Reliability warning above 75 min, auto-scroll to error, clear messaging about server limits |

### What actually fixes it: bring your own routing data

The real solution is to take the routing dependency local — either by self-hosting Valhalla, or by going further and shipping the routing engine + OSM data with the app.

| Path | Effort | What you get |
|---|---|---|
| **Self-hosted Valhalla** (Docker + UK OSM extract) | ~1 evening | No rate limits, no 504s, full 100-min isochrones work fine. Just point the existing Valhalla URL field at `http://localhost:8002`. |
| **Paid hosted provider** (e.g. Mapbox Isochrone API) | A few hours | The Mapbox provider is already stubbed in `src/services/IsochroneService/mapbox/`. Wiring it up properly is the highest-value next task — generous free tier, proper infrastructure, no overload. |
| **Fully offline app** (WASM routing + embedded OSM data) | Multi-week project | The "ideal" answer: a desktop wrapper (Tauri or Electron) shipping a WASM port of Valhalla/OSRM and a ~1.5 GB UK OSM PBF extract. Zero network calls, works on a plane, no service to overload. Significant complexity bump — out of scope for a static SPA but worth tracking as a future direction if this becomes a serious tool. |

The browser-only constraint (a static GitHub Pages SPA) is what makes the offline path infeasible right now: shipping gigabytes of routing data and a routing engine to every visitor isn't viable. Moving to a desktop wrapper is what unlocks it.

### Other known limitations

- **Mode tie-breaking.** Min-variance occasionally picks a tied-but-painful answer (e.g. (30, 30) instead of (20, 20) — both have variance 0). The algorithm correctly minimises its score; a smarter tie-breaker (e.g. min-total among min-variance candidates) is a known follow-up.
- **5-min band quantisation.** Per-person travel times are rounded to the nearest band. Fine for fairness ranking, but a person reachable in 27 min will display as 30 min.
- **One-person-fails-the-whole-compute.** If a person's address can't be geocoded or all their bands fail to fetch, the whole compute fails rather than running with the remaining people.
- **Pareto front cap.** Limited to 12 alternates plus the primary. With N=2 the true Pareto front is a long trade-off curve; you're seeing a representative slice, not the whole thing.

---

## License

MIT — see [LICENSE](LICENSE) for details.
