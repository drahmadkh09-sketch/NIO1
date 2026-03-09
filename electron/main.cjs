const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const { spawn } = require('node:child_process')

let backendProc = null
const APP_PORT = 8787

function resourcesPath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts)
  }
  return path.join(__dirname, '..', ...parts)
}

function startBackend() {
  const serverEntry = resourcesPath('server', 'src', 'index.js')
  const serverCwd = resourcesPath('')

  backendProc = spawn(process.execPath, [serverEntry], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
    },
    stdio: 'pipe',
  })

  backendProc.stdout.on('data', (d) => console.log(`[backend] ${d}`))
  backendProc.stderr.on('data', (d) => console.error(`[backend:error] ${d}`))
  backendProc.on('exit', (code) => console.log(`[backend] exited: ${code}`))
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${APP_PORT}/api/health`)
      if (res.ok) return true
    } catch {
      // ignore until ready
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#020617',
    title: 'Nio Intelligence Agent Command Centre',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  startBackend()
  const ready = await waitForServer()

  if (!ready) {
    dialog.showErrorBox('Backend failed to start', 'Could not start local backend service in time.')
    app.quit()
    return
  }

  await win.loadURL(`http://127.0.0.1:${APP_PORT}`)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProc && !backendProc.killed) {
    backendProc.kill('SIGTERM')
  }
})
