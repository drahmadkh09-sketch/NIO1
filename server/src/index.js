import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { createProject, getLatestUpload, getOverview, listProjects, savePipeline, saveUpload } from './store.js'
import { parseTemplateUpload } from './parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '..', '..', 'dist')

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

app.use(cors())
app.use(express.json({ limit: '4mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.post('/api/projects', (req, res) => {
  const { name, category } = req.body
  if (!name || !category) return res.status(400).json({ error: 'name and category required' })
  const row = createProject(name, category)
  res.json(row)
})

app.get('/api/projects', (_req, res) => {
  res.json(listProjects())
})

app.post('/api/projects/:id/upload-template', upload.single('file'), async (req, res) => {
  const projectId = Number(req.params.id)
  const figmaUrl = req.body?.figmaUrl
  const file = req.file

  if (!file && !figmaUrl) {
    return res.status(400).json({ error: 'Provide ZIP/HTML file or figmaUrl' })
  }

  const parsed = await parseTemplateUpload({
    fileBuffer: file?.buffer,
    originalName: file?.originalname,
    figmaUrl,
    figmaToken: process.env.FIGMA_TOKEN,
  })

  saveUpload(projectId, parsed)
  res.json(parsed)
})

app.post('/api/projects/:id/pipeline', (req, res) => {
  const projectId = Number(req.params.id)
  savePipeline(projectId, req.body)
  res.json({ ok: true })
})

app.post('/api/projects/:id/sync-figma', async (req, res) => {
  const projectId = Number(req.params.id)
  const latest = getLatestUpload(projectId)
  const figmaUrl = latest?.meta?.figmaUrl || latest?.meta?.sourceFigmaUrl || latest?.figmaUrl

  if (!figmaUrl) {
    return res.status(400).json({ error: 'No previous Figma URL found for this project' })
  }

  const parsed = await parseTemplateUpload({
    fileBuffer: undefined,
    originalName: 'Figma Sync',
    figmaUrl,
    figmaToken: process.env.FIGMA_TOKEN,
  })

  saveUpload(projectId, parsed)
  res.json({ ok: true, upload: parsed })
})

app.get('/api/projects/:id/overview', (req, res) => {
  const projectId = Number(req.params.id)
  const row = getOverview(projectId)
  if (!row) return res.status(404).json({ error: 'project not found' })
  res.json(row)
})

app.use(express.static(distDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  console.log(`Full stack app running on http://localhost:${port}`)
})
