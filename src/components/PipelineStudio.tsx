import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  analyzeStyle,
  buildFigmaPayload,
  extractDesignRules,
  generateLayouts,
  parseTemplateText,
} from '../lib/pipeline'
import type { PipelineModuleKey } from '../App'

const API = '/api'

const defaultTemplate = `# Envato Cyber Dashboard
Dark neon control room with glowing cards, charts, top navigation, sidebar,
KPI blocks, interactive tables, and activity timeline.
Primary #06b6d4 Secondary #3b82f6 Accent #a855f7
Typography: 12px 14px 18px 24px
Spacing: 4px 8px 12px 16px 24px
Components: card button chart table modal badge panel`

export default function PipelineStudio({
  activeModule,
  automationSignal,
}: {
  activeModule: PipelineModuleKey
  automationSignal: number
}) {
  const [raw, setRaw] = useState(defaultTemplate)
  const [projectName, setProjectName] = useState('AK Layout Project')
  const [category, setCategory] = useState('SaaS')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [status, setStatus] = useState('Idle')
  const [automationLog, setAutomationLog] = useState<string[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [figmaUrl, setFigmaUrl] = useState('')
  const [uploadSummary, setUploadSummary] = useState<string>('No upload yet')
  const [uploadData, setUploadData] = useState<any>(null)
  const [previousUploadData, setPreviousUploadData] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'failed'>('idle')
  const [autoPoll, setAutoPoll] = useState(false)
  const [pollIntervalMs, setPollIntervalMs] = useState(30000)
  const [lastDiff, setLastDiff] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const parsed = useMemo(() => parseTemplateText(raw), [raw])

  const figmaMappedComponents = useMemo(() => {
    const sampled = uploadData?.meta?.sampledNodes ?? []
    return sampled
      .filter((n: any) => ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(n.type))
      .slice(0, 24)
      .map((n: any) => ({ name: n.name || n.type, variants: ['default', 'hover'], autoLayout: true }))
  }, [uploadData])

  const analysis = useMemo(() => {
    const base = analyzeStyle(parsed)
    if (uploadData?.type === 'figma') {
      const colorHints = (uploadData.summary?.colors ?? []).slice(0, 5)
      return {
        ...base,
        dominantColors: colorHints.length ? colorHints : base.dominantColors,
        componentPatterns: figmaMappedComponents.length
          ? ([...new Set(figmaMappedComponents.map((c: { name: string }) => c.name.toLowerCase()))].slice(0, 12) as string[])
          : base.componentPatterns,
      }
    }
    return base
  }, [parsed, uploadData, figmaMappedComponents])

  const rules = useMemo(() => {
    const base = extractDesignRules(analysis)
    const textStyles: string[] = uploadData?.meta?.textStyles ?? []
    const colorStyleNames: string[] = uploadData?.summary?.colors ?? []

    if (!uploadData?.meta?.deepFetch) return base

    return {
      ...base,
      tokens: {
        ...base.tokens,
        color: {
          ...base.tokens.color,
          figma_primary_style: colorStyleNames[0] ?? base.tokens.color.primary,
          figma_secondary_style: colorStyleNames[1] ?? base.tokens.color.secondary,
        },
        typography: {
          ...base.tokens.typography,
          figma_text_style_1: textStyles[0] ?? base.tokens.typography.body,
          figma_text_style_2: textStyles[1] ?? base.tokens.typography.h2,
        },
      },
    }
  }, [analysis, uploadData])

  const figma = useMemo(() => {
    const base = buildFigmaPayload(rules, parsed.name)
    if (!figmaMappedComponents.length) return base
    return {
      ...base,
      components: [...figmaMappedComponents, ...base.components].slice(0, 60),
    }
  }, [rules, parsed.name, figmaMappedComponents])

  const layouts = useMemo(() => generateLayouts(rules), [rules])

  const oldComponents = useMemo(() => {
    const sampled = previousUploadData?.meta?.sampledNodes ?? []
    return sampled
      .filter((n: any) => ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(n.type))
      .slice(0, 12)
      .map((n: any) => n.name || n.type)
  }, [previousUploadData])

  const newComponents = useMemo(() => {
    const sampled = uploadData?.meta?.sampledNodes ?? []
    return sampled
      .filter((n: any) => ['COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(n.type))
      .slice(0, 12)
      .map((n: any) => n.name || n.type)
  }, [uploadData])

  const oldTokens = useMemo(() => {
    const colors = previousUploadData?.summary?.colors ?? []
    const text = previousUploadData?.meta?.textStyles ?? []
    return [...colors.slice(0, 6), ...text.slice(0, 6)]
  }, [previousUploadData])

  const newTokens = useMemo(() => {
    const colors = uploadData?.summary?.colors ?? []
    const text = uploadData?.meta?.textStyles ?? []
    return [...colors.slice(0, 6), ...text.slice(0, 6)]
  }, [uploadData])

  const dashboardStats = useMemo(() => {
    const componentCount = figma.components.length
    const tokenCount = Object.keys(rules.tokens.color).length + Object.keys(rules.tokens.typography).length
    const layoutCount = layouts.length
    const styleCount = uploadData?.meta?.stylesCount ?? 0
    return [
      { label: 'Components', value: componentCount },
      { label: 'Design Tokens', value: tokenCount },
      { label: 'Layouts', value: layoutCount },
      { label: 'Figma Styles', value: styleCount },
    ]
  }, [figma.components.length, layouts.length, rules.tokens.color, rules.tokens.typography, uploadData])

  const flowSteps: { label: string; key: PipelineModuleKey }[] = [
    { label: 'Upload', key: 'template' },
    { label: 'Analyze', key: 'analyzer' },
    { label: 'Rules', key: 'rules' },
    { label: 'Components', key: 'components' },
    { label: 'Layouts', key: 'layouts' },
    { label: 'Export', key: 'export' },
  ]
  const completion = useMemo(() => {
    let done = 0
    if (uploadData) done++
    if (analysis.componentPatterns.length) done++
    if (Object.keys(rules.tokens.color).length) done++
    if (figma.components.length) done++
    if (layouts.length) done++
    if (automationLog.some((x) => x.toLowerCase().includes('export bundle generated'))) done++
    return Math.round((done / flowSteps.length) * 100)
  }, [uploadData, analysis.componentPatterns.length, rules.tokens.color, figma.components.length, layouts.length, automationLog, flowSteps.length])

  const moduleHealth = useMemo(
    () => [
      { name: 'Template', state: uploadData ? 'Ready' : 'Waiting' },
      { name: 'Analyzer', state: analysis.componentPatterns.length ? 'Ready' : 'Waiting' },
      { name: 'Rules', state: Object.keys(rules.tokens.color).length ? 'Ready' : 'Waiting' },
      { name: 'Components', state: figma.components.length ? 'Ready' : 'Waiting' },
      { name: 'Layouts', state: layouts.length ? 'Ready' : 'Waiting' },
      { name: 'Sync', state: syncStatus === 'running' ? 'Running' : syncStatus === 'failed' ? 'Failed' : 'Idle' },
    ],
    [uploadData, analysis.componentPatterns.length, rules.tokens.color, figma.components.length, layouts.length, syncStatus],
  )

  const logStep = (msg: string) => {
    setAutomationLog((prev) => [msg, ...prev].slice(0, 10))
  }

  const ensureProject = async () => {
    if (projectId) return projectId
    setStatus('Creating project...')
    const r = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, category }),
    })
    const data = await r.json()
    setProjectId(data.id)
    logStep(`Project #${data.id} created`)
    return data.id as number
  }

  const runModuleAutomation = async (module: PipelineModuleKey) => {
    const pid = await ensureProject()
    if (!pid) return

    const labels: Record<PipelineModuleKey, string> = {
      template: 'Template Upload',
      analyzer: 'Style Analyzer',
      rules: 'Design Rules',
      components: 'Component Builder',
      layouts: 'AI Layout Generator',
      export: 'Export Module',
    }

    setStatus(`Running ${labels[module]} automation...`)
    logStep(`Automation started: ${labels[module]}`)

    if (module === 'template' && (uploadFile || figmaUrl.trim())) {
      await uploadTemplate()
    }

    if (module === 'export') {
      const blob = new Blob([JSON.stringify({ parsed, analysis, rules, figma, layouts }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.replace(/\s+/g, '_')}_design_export.json`
      a.click()
      URL.revokeObjectURL(url)
      logStep('Export bundle generated and downloaded')
      setStatus('Export complete ✅')
      return
    }

    await fetch(`${API}/projects/${pid}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: parsed, analysis, rules, figmaPayload: figma, layouts, module }),
    })

    logStep(`${labels[module]} completed and persisted`)
    setStatus(`${labels[module]} completed ✅`)
  }

  const handleStepClick = async (module: PipelineModuleKey) => {
    if (module === 'template' && !uploadFile && !figmaUrl.trim()) {
      fileInputRef.current?.click()
      setStatus('Choose a ZIP/HTML template file or paste Figma URL, then click Upload & Parse')
      return
    }
    await runModuleAutomation(module)
  }

  useEffect(() => {
    if (!automationSignal) return
    runModuleAutomation(activeModule)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationSignal])

  useEffect(() => {
    if (!autoPoll || !projectId) return
    const id = setInterval(() => {
      syncFromFigma()
    }, pollIntervalMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPoll, projectId, pollIntervalMs])

  const uploadTemplate = async () => {
    const pid = await ensureProject()
    if (!pid) return

    const form = new FormData()
    if (uploadFile) form.append('file', uploadFile)
    if (figmaUrl.trim()) form.append('figmaUrl', figmaUrl.trim())

    if (!uploadFile && !figmaUrl.trim()) {
      setStatus('Attach ZIP/HTML or provide Figma URL first')
      return
    }

    setStatus('Uploading and parsing template...')
    const r = await fetch(`${API}/projects/${pid}/upload-template`, {
      method: 'POST',
      body: form,
    })
    const data = await r.json()
    if (uploadData) setPreviousUploadData(uploadData)
    setUploadData(data)
    const deep = data?.meta?.deepFetch ? ' • deep figma fetch ON' : ''
    const nodeScope = data?.meta?.nodeId ? ` • node: ${data.meta.nodeId}` : ''
    setUploadSummary(`${data.type.toUpperCase()} parsed • sections: ${(data.summary?.sections || []).join(', ')}${deep}${nodeScope}`)
    logStep(`Template parsed: ${data.type}`)
    setStatus('Template parsed ✅')
  }

  const createProject = async () => {
    setStatus('Creating project...')
    const r = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, category }),
    })
    const data = await r.json()
    setProjectId(data.id)
    setStatus(`Project created: #${data.id}`)
  }

  const savePipeline = async () => {
    if (!projectId) return setStatus('Create project first')
    setStatus('Saving pipeline output...')
    await fetch(`${API}/projects/${projectId}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: parsed, analysis, rules, figmaPayload: figma, layouts }),
    })
    setStatus('Saved to backend DB ✅')
  }

  const loadOverview = async () => {
    if (!projectId) return setStatus('Create/select project first')
    setStatus('Loading saved overview...')
    const r = await fetch(`${API}/projects/${projectId}/overview`)
    const data = await r.json()
    if (data.upload) {
      setUploadData(data.upload)
      const deep = data.upload?.meta?.deepFetch ? ' • deep figma fetch ON' : ''
      setUploadSummary(`${data.upload.type.toUpperCase()} parsed • sections: ${(data.upload.summary?.sections || []).join(', ')}${deep}`)
    }
    setStatus(`Loaded overview for project #${data.project.id}`)
  }

  const syncFromFigma = async () => {
    if (!projectId) return setStatus('Create/select project first')
    setSyncing(true)
    setSyncStatus('running')
    setStatus('Sync from Figma started...')

    const once = async () => {
      const prev = uploadData
      const r = await fetch(`${API}/projects/${projectId}/sync-figma`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) {
        setStatus(data.error || 'Sync failed')
        setSyncStatus('failed')
        return false
      }
      if (prev) setPreviousUploadData(prev)
      setUploadData(data.upload)
      const deep = data.upload?.meta?.deepFetch ? ' • deep figma fetch ON' : ''
      setUploadSummary(`${data.upload.type.toUpperCase()} synced • sections: ${(data.upload.summary?.sections || []).join(', ')}${deep}`)

      const diff: string[] = []
      const prevHead = new Set((prev?.summary?.headings ?? []).slice(0, 40))
      const nowHead = new Set((data.upload?.summary?.headings ?? []).slice(0, 40))
      const addedHeadings = [...nowHead].filter((x) => !prevHead.has(x)).slice(0, 5)
      const removedHeadings = [...prevHead].filter((x) => !nowHead.has(x)).slice(0, 5)
      if (addedHeadings.length) diff.push(`+ headings: ${addedHeadings.join(' | ')}`)
      if (removedHeadings.length) diff.push(`- headings: ${removedHeadings.join(' | ')}`)

      const prevStyles = prev?.meta?.stylesCount ?? 0
      const nowStyles = data.upload?.meta?.stylesCount ?? 0
      if (prevStyles !== nowStyles) diff.push(`stylesCount: ${prevStyles} → ${nowStyles}`)
      if (!diff.length) diff.push('No major structured changes detected')
      setLastDiff(diff)

      setStatus('Figma sync complete ✅')
      setSyncStatus('idle')
      logStep('Figma synced and modules refreshed')

      await runModuleAutomation('analyzer')
      await runModuleAutomation('rules')
      await runModuleAutomation('components')
      await runModuleAutomation('layouts')
      return true
    }

    await once()
    setSyncing(false)
  }

  return (
    <section className="pipeline-shell">
      <h2>Nio Intelligence Pipeline Dashboard</h2>
      <p>Upload sources, sync Figma, auto-generate rules, components, layouts and export-ready design intelligence.</p>

      <article className="panel" style={{ marginBottom: 12 }}>
        <h3>Pipeline Journey</h3>
        <div className="stepper-row">
          {flowSteps.map((s, i) => (
            <button
              key={s.key}
              className={`step-chip ${i < Math.floor((completion / 100) * flowSteps.length) ? 'step-chip-done' : ''}`}
              onClick={() => handleStepClick(s.key)}
              title={`Run ${s.label}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="chip">Completion: {completion}%</span>
          <span className="chip">Project: {projectName}</span>
          <span className="chip">Category: {category}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: '#1f2937', marginTop: 8 }}>
          <motion.div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#06b6d4,#22c55e)' }} initial={{ width: 0 }} animate={{ width: `${completion}%` }} />
        </div>
      </article>

      <div className="layout-cards" style={{ marginBottom: 12 }}>
        {dashboardStats.map((s, i) => (
          <motion.div
            key={s.label}
            className="layout-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <b>{s.label}</b>
            <h4 style={{ margin: '6px 0' }}>{s.value}</h4>
            <div style={{ height: 6, borderRadius: 999, background: '#1f2937' }}>
              <motion.div
                style={{ height: 6, borderRadius: 999, background: 'linear-gradient(90deg,#06b6d4,#3b82f6)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, 12 + s.value * 8)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div className="layout-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} style={{ marginBottom: 12 }}>
        <b>Automation Throughput Visualisation</b>
        <svg viewBox="0 0 640 120" width="100%" height="120" role="img" aria-label="pipeline throughput chart">
          <polyline fill="none" stroke="#22d3ee" strokeWidth="3" points="20,90 110,70 200,76 290,44 380,54 470,36 560,42 620,26" />
          <polyline fill="none" stroke="#a855f7" strokeWidth="2" points="20,100 110,92 200,86 290,74 380,70 470,60 560,54 620,48" opacity="0.85" />
          {['Template','Analyzer','Rules','Components','Layouts','Export'].map((l, i) => (
            <text key={l} x={20 + i * 100} y={116} fill="#94a3b8" fontSize="10">{l}</text>
          ))}
        </svg>
      </motion.div>

      <div className="layout-cards" style={{ marginBottom: 12 }}>
        {moduleHealth.map((m) => (
          <div className="layout-card" key={m.name}>
            <b>{m.name}</b>
            <div className={`health-badge health-${m.state.toLowerCase()}`}>{m.state}</div>
          </div>
        ))}
      </div>

      <article className="panel" style={{ marginBottom: 12 }}>
        <h3>Project & Pipeline Control</h3>
        <div className="chip-row">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>SaaS</option>
            <option>Portfolio</option>
            <option>Ecommerce</option>
          </select>
          <button className="tab-btn" onClick={createProject}>Create Project</button>
          <button className="tab-btn" onClick={savePipeline}>Save Pipeline</button>
          <button className="tab-btn" onClick={loadOverview}>Load Overview</button>
          <button className="tab-btn" onClick={syncFromFigma} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync from Figma'}</button>
          <label className="chip"><input type="checkbox" checked={autoPoll} onChange={(e) => setAutoPoll(e.target.checked)} /> Auto-poll</label>
          <select value={pollIntervalMs} onChange={(e) => setPollIntervalMs(Number(e.target.value))}>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </div>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="chip">Project ID: {projectId ?? '-'}</span>
          <span className="chip">Status: {status}</span>
          <span className="chip">Sync: {syncStatus}</span>
          <span className="chip">Active Module: {activeModule}</span>
          <span className="chip">Upload: {uploadSummary}</span>
        </div>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <input ref={fileInputRef} type="file" accept=".zip,.html,.htm" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <input value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="Figma file URL (supports ?node-id=...)" />
          <button className="tab-btn" onClick={uploadTemplate}>Upload & Parse</button>
        </div>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <button className="tab-btn" onClick={() => runModuleAutomation('template')}>Run Template</button>
          <button className="tab-btn" onClick={() => runModuleAutomation('analyzer')}>Run Analyzer</button>
          <button className="tab-btn" onClick={() => runModuleAutomation('rules')}>Run Rules</button>
          <button className="tab-btn" onClick={() => runModuleAutomation('components')}>Run Components</button>
          <button className="tab-btn" onClick={() => runModuleAutomation('layouts')}>Run Layouts</button>
          <button className="tab-btn" onClick={() => runModuleAutomation('export')}>Run Export</button>
        </div>
        <ul>
          {automationLog.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <h3 style={{ marginTop: 8 }}>Change Diff (Last Figma Sync)</h3>
        <ul>
          {lastDiff.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        <h3 style={{ marginTop: 8 }}>Visual Side-by-Side Diff</h3>
        <div className="layout-cards">
          <div className="layout-card">
            <b>Old Components</b>
            <ul>{oldComponents.map((c: string) => <li key={`old-c-${c}`}>{c}</li>)}</ul>
            <b>Old Tokens</b>
            <ul>{oldTokens.map((t: string) => <li key={`old-t-${t}`}>{t}</li>)}</ul>
          </div>
          <div className="layout-card">
            <b>New Components</b>
            <ul>{newComponents.map((c: string) => <li key={`new-c-${c}`}>{c}</li>)}</ul>
            <b>New Tokens</b>
            <ul>{newTokens.map((t: string) => <li key={`new-t-${t}`}>{t}</li>)}</ul>
          </div>
        </div>

        <h3 style={{ marginTop: 8 }}>Sync Visualisation</h3>
        <div className="layout-card">
          <svg viewBox="0 0 420 120" width="100%" height="120" role="img" aria-label="sync graph">
            {[oldComponents.length, oldTokens.length, newComponents.length, newTokens.length].map((v, i) => {
              const h = Math.max(8, v * 8)
              const x = 30 + i * 90
              const y = 100 - h
              const color = i < 2 ? '#64748b' : '#06b6d4'
              return <rect key={i} x={x} y={y} width="42" height={h} rx="6" fill={color} opacity="0.9" />
            })}
            <text x="26" y="114" fill="#94a3b8" fontSize="10">Old C</text>
            <text x="116" y="114" fill="#94a3b8" fontSize="10">Old T</text>
            <text x="206" y="114" fill="#94a3b8" fontSize="10">New C</text>
            <text x="296" y="114" fill="#94a3b8" fontSize="10">New T</text>
          </svg>
        </div>
      </article>

      <div className="pipeline-grid">
        <article className="panel">
          <h3>1) Template Input</h3>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={16} />
          <div className="chip-row">
            <span className="chip">Template: {parsed.name}</span>
            <span className="chip">Components: {parsed.components.length}</span>
          </div>
        </article>

        <article className="panel">
          <h3>2) Style Analyzer</h3>
          <ul>
            <li>Mood: {analysis.mood}</li>
            <li>Accent: {analysis.accentColor}</li>
            <li>Type scale: {analysis.typographyScale.join(', ')}</li>
            <li>Spacing: {analysis.spacingScale.join(', ')}</li>
          </ul>
          <div className="swatches">
            {analysis.dominantColors.map((c: string) => (
              <span key={c} className="swatch" style={{ background: c }} title={c} />
            ))}
          </div>
        </article>

        <article className="panel">
          <h3>3) Design Rules Extraction</h3>
          <pre>{JSON.stringify(rules, null, 2)}</pre>
        </article>

        <article className="panel">
          <h3>4) Figma Component Builder Payload</h3>
          {!!figmaMappedComponents.length && (
            <>
              <b>Auto-mapped imported components</b>
              <div className="layout-cards" style={{ margin: '8px 0' }}>
                {figmaMappedComponents.slice(0, 8).map((c: { name: string }) => (
                  <div key={c.name} className="layout-card">{c.name}</div>
                ))}
              </div>
            </>
          )}
          <pre>{JSON.stringify(figma, null, 2)}</pre>
        </article>

        <article className="panel panel-wide">
          <h3>5) AI Generated Layouts</h3>
          <div className="layout-cards">
            {layouts.map((layout) => (
              <div key={layout.name} className="layout-card">
                <h4>{layout.name}</h4>
                <b>Sections</b>
                <ul>{layout.sections.map((s) => <li key={s}>{s}</li>)}</ul>
                <b>Improvements</b>
                <ul>{layout.improvements.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
