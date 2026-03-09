import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'server', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'db.json')

const initial = {
  counters: { project: 1, pipeline: 1, upload: 1 },
  projects: [],
  pipelines: [],
  uploads: [],
}

function readDb() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf8')
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'))
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8')
}

export function createProject(name, category) {
  const db = readDb()
  const row = { id: db.counters.project++, name, category, created_at: new Date().toISOString() }
  db.projects.push(row)
  writeDb(db)
  return row
}

export function listProjects() {
  const db = readDb()
  return [...db.projects].reverse()
}

export function savePipeline(projectId, payload) {
  const db = readDb()
  const row = {
    id: db.counters.pipeline++,
    projectId,
    payload,
    created_at: new Date().toISOString(),
  }
  db.pipelines.push(row)
  writeDb(db)
  return row
}

export function saveUpload(projectId, upload) {
  const db = readDb()
  const row = {
    id: db.counters.upload++,
    projectId,
    upload,
    created_at: new Date().toISOString(),
  }
  db.uploads.push(row)
  writeDb(db)
  return row
}

export function getLatestUpload(projectId) {
  const db = readDb()
  return [...db.uploads].reverse().find((u) => u.projectId === projectId)?.upload ?? null
}

export function getOverview(projectId) {
  const db = readDb()
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) return null
  const latest = [...db.pipelines].reverse().find((p) => p.projectId === projectId)
  const latestUpload = [...db.uploads].reverse().find((u) => u.projectId === projectId)
  return { project, upload: latestUpload?.upload ?? null, ...(latest?.payload ?? {}) }
}
