# OpenClaw Agent Command Center (v1)

Clone-inspired implementation of the provided Envato-style 3D cyberpunk command center spec.

## Included in current build (v2 in progress)

- React + TypeScript + Framer Motion app scaffold
- Cyberpunk visual theme (neon grid, glow, sync chamber)
- 6 stations + 6 agents with role/color mapping
- Drag-to-rotate + scroll-to-zoom camera controls
- Hover task bubbles and collaboration line baseline
- **Pipeline Studio (web UI):**
  - Envato template text input
  - Style analyzer output
  - Design rules extraction JSON
  - Figma component payload JSON
  - AI-generated layout proposals

## Run (Frontend)

```bash
cd agent-command-center
npm install
npm run dev
```

## Run (Backend API + SQLite)

```bash
cd agent-command-center/server
npm install
# Optional for deep Figma import (PowerShell)
# $env:FIGMA_TOKEN="your_figma_personal_access_token"
npm run dev
```

API base: `http://localhost:8787/api`

### Deep Figma Import
When `FIGMA_TOKEN` is set, Figma URL uploads fetch structured data from Figma API:
- file nodes (frames/components/component sets)
- styles metadata (text/fill)
- sampled component tree in upload meta

## Desktop Build (Mac)

For a no-command client delivery package, see:
- `README-MAC-DESKTOP.md`

## Next (v2)

- Real drag/zoom camera controls (X/Z rotation + zoom springs)
- True 3D transform stacking (`preserve-3d`, face-level geometry)
- Agent state machine with timers and task pool
- Collision avoidance and path trails
- Collaboration links (SVG) + event logs panel
- Component tokenization + Figma design token export
