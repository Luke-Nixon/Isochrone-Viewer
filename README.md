<div align="center">

# 🗺️ Isochrone Viewer

**Generate travel-time polygons. Visualise them instantly. Export directly to Rightmove.**

[![Deploy](https://github.com/Luke-Nixon/Isochrone-Viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/Luke-Nixon/Isochrone-Viewer/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?logo=github)](https://luke-nixon.github.io/Isochrone-Viewer/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![MUI](https://img.shields.io/badge/MUI-7-007FFF?logo=mui&logoColor=white)](https://mui.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

<br />

[**→ Open Live App**](https://luke-nixon.github.io/Isochrone-Viewer/) &nbsp;·&nbsp; [Report Bug](https://github.com/Luke-Nixon/Isochrone-Viewer/issues) &nbsp;·&nbsp; [Request Feature](https://github.com/Luke-Nixon/Isochrone-Viewer/issues)

</div>

---

## What is this?

Isochrone Viewer is a browser-based tool that answers the question: **"Where can I reach within X minutes?"**

Enter an address, pick a travel time (up to 5 hours) and mode, and the app generates an accurate polygon showing your reachable area. That polygon is then formatted as a **direct Rightmove property search URL** — one click and you're browsing properties within your commute zone.

No backend. No account required. No API key needed for the default provider.

---

## Features

| | Feature |
|---|---|
| 🔍 | **UK address search** — powered by Nominatim with real-time autocomplete |
| 🕐 | **Travel time slider** — 1 minute to 5 hours in fine-grained increments |
| 🚗 | **Travel modes** — driving, walking, cycling, and transit |
| 🗺️ | **Interactive map** — React-Leaflet with dark/light theme toggle |
| 📍 | **Live polygon overlay** — isochrone and Rightmove export polygon both rendered on the map |
| 🔗 | **Rightmove export** — one-click open or copy, with adaptive polygon simplification |
| ⚡ | **Zero backend** — fully static, deployable to GitHub Pages |
| 💾 | **Persistent config** — provider settings saved to localStorage |

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
    <td><strong>Map</strong></td>
    <td>React-Leaflet — CartoDB Dark Matter / OpenStreetMap tiles</td>
  </tr>
  <tr>
    <td><strong>Isochrone API</strong></td>
    <td>Valhalla (public OSM instance — no key required)</td>
  </tr>
  <tr>
    <td><strong>Geocoding</strong></td>
    <td>Nominatim (OpenStreetMap)</td>
  </tr>
  <tr>
    <td><strong>Schema Validation</strong></td>
    <td>Zod</td>
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
├── components/
│   ├── MapView/          # React-Leaflet map, theme toggle, polygon layers
│   ├── SearchParameters/ # Address search, travel time/mode controls
│   ├── ProviderConfig/   # Per-provider config tabs (Valhalla, Mapbox, OpenRoute)
│   └── GeoExport/        # Rightmove URL builder, polygon encoder, copy/open
├── services/
│   ├── GeocodingService/ # Nominatim address search + autocomplete hook
│   └── IsochroneService/ # Valhalla API client + provider config storage
└── theme.ts              # MUI glassmorphic dark theme
```

**Data flow:**
```
Address input → Nominatim geocode → [lat, lng]
                                         ↓
                          Valhalla isochrone POST /isochrone
                                         ↓
                          GeoJSON FeatureCollection (Polygon)
                                         ↓
                    ┌────────────────────┴───────────────────┐
                    ↓                                        ↓
             Leaflet GeoJSON layer              Google Encoded Polyline
                  (map overlay)                              ↓
                                         USERDEFINEDAREA Rightmove URL
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
| **Valhalla** | ✅ Implemented | Not required | Defaults to `valhalla1.openstreetmap.de` |
| **Mapbox** | 🚧 Coming soon | Required | — |
| **OpenRouteService** | 🚧 Coming soon | Required | — |

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

---

## Local Development

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
