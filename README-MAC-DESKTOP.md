# Nio Intelligence Agent Command Centre — Mac Desktop Build

This guide creates a **double-click Mac app (.dmg)** so your client does not need terminal commands.

## What gets packaged
- Frontend (React build)
- Backend API server (Express)
- Parser modules (ZIP/HTML/Figma)

The Electron app auto-starts local backend internally and opens the app window.

---

## 1) Prerequisites (builder machine)
- macOS machine (required to build native .dmg)
- Node.js 20+
- Xcode Command Line Tools installed

---

## 2) Install dependencies
From project root:

```bash
npm install
cd server && npm install && cd ..
```

---

## 3) Optional: Deep Figma support
Set token before packaging if you want deep Figma imports:

```bash
export FIGMA_TOKEN="your_figma_personal_access_token"
```

---

## 4) Build desktop installer

```bash
npm run pack:mac
```

Output is generated in:
- `dist/*.dmg`

---

## 5) Deliver to client
Send the generated `.dmg` file.
Client flow:
1. Open `.dmg`
2. Drag app to Applications
3. Launch app

No terminal commands required on client machine.

---

## Notes
- First launch may show Apple security warning for unsigned apps.
- For public distribution without warnings, add Apple code-signing + notarization.
- App uses local backend internally on port `8787`.
