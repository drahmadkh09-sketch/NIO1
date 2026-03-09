import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { AGENTS, ROOM, STATIONS } from '../lib/constants'
import type { Agent, AgentStatus } from '../lib/types'
import type { PipelineModuleKey } from '../App'

type SimAgent = Agent & {
  tx: number
  ty: number
  trail: { x: number; y: number }[]
}

type LogItem = { id: number; text: string }

const moduleByAgent: Record<string, string> = {
  atlas: 'Template Upload Module',
  sage: 'Style Analyzer Module',
  cipher: 'Design Rules Engine',
  echo: 'Component Builder (Figma Sync)',
  nova: 'AI Layout Generator',
  nexus: 'Export Module',
}

const moduleKeyByAgent: Record<string, PipelineModuleKey> = {
  atlas: 'template',
  sage: 'analyzer',
  cipher: 'rules',
  echo: 'components',
  nova: 'layouts',
  nexus: 'export',
}

const statusLight: Record<AgentStatus, string> = {
  idle: '#9ca3af',
  working: '#22c55e',
  thinking: '#a855f7',
  collaborating: '#3b82f6',
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min

export default function CommandCenter({ onSelectModule }: { onSelectModule: (module: PipelineModuleKey) => void }) {
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [cam, setCam] = useState({ x: 60, z: -45, zoom: 1 })
  const [agents, setAgents] = useState<SimAgent[]>(
    AGENTS.map((a) => ({ ...a, tx: a.x, ty: a.y, trail: [{ x: a.x, y: a.y }] })),
  )
  const [collabPair, setCollabPair] = useState<[string, string] | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([{ id: 1, text: 'System initialized: 6 agents online.' }])
  const [selectedAgent, setSelectedAgent] = useState<string>('atlas')
  const logCounter = useRef(2)

  const last = useRef<{ x: number; y: number } | null>(null)

  const rx = useMotionValue(cam.x)
  const rz = useMotionValue(cam.z)
  const zoom = useMotionValue(cam.zoom)
  const sx = useSpring(rx, { stiffness: 100, damping: 30 })
  const sz = useSpring(rz, { stiffness: 100, damping: 30 })
  const szoom = useSpring(zoom, { stiffness: 100, damping: 30 })

  useEffect(() => {
    const tick = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.status === 'collaborating') return a
          const dx = a.tx - a.x
          const dy = a.ty - a.y
          const dist = Math.hypot(dx, dy)

          let nx = a.x
          let ny = a.y
          let status: AgentStatus = a.status

          if (dist > 2) {
            nx += (dx / dist) * 3
            ny += (dy / dist) * 3
            status = 'working'
          } else {
            status = Math.random() > 0.75 ? 'thinking' : 'idle'
          }

          const trail = [...a.trail, { x: nx, y: ny }].slice(-15)
          return { ...a, x: nx, y: ny, status, trail }
        }),
      )
    }, 120)

    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const retarget = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => {
          if (Math.random() > 0.3 || a.status === 'collaborating') return a
          const s = STATIONS[Math.floor(Math.random() * STATIONS.length)]
          return {
            ...a,
            tx: Math.max(80, Math.min(ROOM.width - 80, s.x + rand(-12.5, 12.5))),
            ty: Math.max(80, Math.min(ROOM.height - 80, s.y + rand(-12.5, 12.5))),
            task: `Moving to ${s.name}`,
            status: 'working',
          }
        }),
      )
    }, 5000)

    return () => clearInterval(retarget)
  }, [])

  useEffect(() => {
    const collab = setInterval(() => {
      if (Math.random() > 0.4) return
      setAgents((prev) => {
        if (prev.length < 2) return prev
        const i = Math.floor(Math.random() * prev.length)
        let j = Math.floor(Math.random() * prev.length)
        while (j === i) j = Math.floor(Math.random() * prev.length)

        const a = prev[i]
        const b = prev[j]
        setCollabPair([a.id, b.id])
        setLogs((p) => [{ id: logCounter.current++, text: `${a.name} synced with ${b.name} in chamber.` }, ...p].slice(0, 8))

        const next = prev.map((x, idx) => {
          if (idx === i) return { ...x, tx: 400, ty: 350, status: 'collaborating' as AgentStatus }
          if (idx === j) return { ...x, tx: 500, ty: 350, status: 'collaborating' as AgentStatus }
          return x
        })

        setTimeout(() => {
          setCollabPair(null)
          setAgents((curr) => curr.map((x) => (x.status === 'collaborating' ? { ...x, status: 'idle' as AgentStatus } : x)))
        }, 3500)

        return next
      })
    }, 8000)

    return () => clearInterval(collab)
  }, [])

  const selectedModule = moduleByAgent[selectedAgent]

  const pairPoints = useMemo(() => {
    if (!collabPair) return null
    const a = agents.find((x) => x.id === collabPair[0])
    const b = agents.find((x) => x.id === collabPair[1])
    if (!a || !b) return null
    return { x1: a.x + 10, y1: a.y + 10, x2: b.x + 10, y2: b.y + 10, color: a.color }
  }, [agents, collabPair])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setDragging(true)
    last.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !last.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    const nx = Math.max(20, Math.min(80, cam.x + dy * 0.3))
    const nz = cam.z - dx * 0.3
    setCam((p) => ({ ...p, x: nx, z: nz }))
    rx.set(nx)
    rz.set(nz)
    last.current = { x: e.clientX, y: e.clientY }
  }

  const endDrag = () => {
    setDragging(false)
    last.current = null
  }

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const next = Math.max(0.5, Math.min(1.5, cam.zoom - e.deltaY * 0.001))
    setCam((p) => ({ ...p, zoom: next }))
    zoom.set(next)
  }

  return (
    <div className="cc-wrapper">
      <div className="hud">🎮 Drag to Rotate | 🖱️ Scroll to Zoom</div>
      <div className="metrics" style={{ marginBottom: 10 }}>
        <span>X: {cam.x.toFixed(1)}°</span>
        <span>Z: {cam.z.toFixed(1)}°</span>
        <span>Zoom: {(cam.zoom * 100).toFixed(0)}%</span>
      </div>

      <div className="v2-grid">
        <div
          className="scene-wrap"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onWheel={onWheel}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <motion.div className="scene-3d" style={{ rotateX: sx, rotateZ: sz, scale: szoom, transformStyle: 'preserve-3d' }}>
            <div className="cc-room" style={{ width: ROOM.width, height: ROOM.height }}>
              <div className="cc-grid" />
              <div className="sync-chamber">
                <div className="sync-ring" />
                <div className="sync-label">SYNC CHAMBER</div>
              </div>

              <svg className="collab-svg" width={ROOM.width} height={ROOM.height}>
                {pairPoints && (
                  <line
                    x1={pairPoints.x1}
                    y1={pairPoints.y1}
                    x2={pairPoints.x2}
                    y2={pairPoints.y2}
                    stroke={pairPoints.color}
                    strokeWidth="3"
                    strokeDasharray="8 4"
                    opacity="0.8"
                  />
                )}
              </svg>

              {STATIONS.map((station) => (
                <motion.div
                  key={station.id}
                  className="station"
                  style={{ left: station.x - 32, top: station.y - 32, borderColor: station.color, boxShadow: `0 0 20px ${station.color}66` }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="station-icon" style={{ color: station.color }}>◈</div>
                  <div className="station-name">{station.name}</div>
                </motion.div>
              ))}

              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={`agent ${selectedAgent === agent.id ? 'agent-selected' : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setSelectedAgent(agent.id)
                    setLogs((p) => [{ id: logCounter.current++, text: `${agent.name} opened ${moduleByAgent[agent.id]}.` }, ...p].slice(0, 8))
                    onSelectModule(moduleKeyByAgent[agent.id])
                  }}
                  onMouseEnter={() => setHovered(agent.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ left: agent.x, top: agent.y, transform: hovered === agent.id ? 'scale(1.1)' : 'scale(1)' }}
                >
                  {agent.trail.map((t, idx) => (
                    <span
                      key={`${agent.id}-${idx}`}
                      className="trail-dot"
                      style={{ left: t.x - agent.x + 8, top: t.y - agent.y + 8, background: agent.color, opacity: (idx / 15) * 0.6 }}
                    />
                  ))}

                  <div className="agent-body" style={{ borderColor: `${agent.color}cc`, boxShadow: `0 0 16px ${agent.color}66` }}>
                    <div className="agent-head" style={{ background: agent.color }} />
                    <div className="agent-status" style={{ background: statusLight[agent.status] }} />
                  </div>
                  {hovered === agent.id && (
                    <div className="task-bubble" style={{ borderColor: `${agent.color}99` }}>
                      <b style={{ color: agent.color }}>{agent.role}</b>
                      <span>{agent.task}</span>
                    </div>
                  )}
                  <div className="agent-tag" style={{ borderColor: `${agent.color}99` }}>
                    <b style={{ color: agent.color }}>{agent.name}</b>
                    <span>{agent.role}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <aside className="panel event-panel">
          <h3>Neural Activity Log</h3>
          <ul>
            {logs.map((l) => (
              <li key={l.id}>{l.text}</li>
            ))}
          </ul>
          <div className="chip-row" style={{ marginTop: 10 }}>
            <span className="chip">Agents: {agents.length}</span>
            <span className="chip">Stations: {STATIONS.length}</span>
            <span className="chip">State Machine: Active</span>
          </div>
          <h3 style={{ marginTop: 12 }}>Active Agent Routing</h3>
          <div className="chip-row">
            <span className="chip">Agent: {selectedAgent}</span>
            <span className="chip">Module: {selectedModule}</span>
          </div>

          <h3 style={{ marginTop: 12 }}>Quick Module Launch</h3>
          <div className="module-grid">
            {AGENTS.map((a) => (
              <button
                key={`dock-${a.id}`}
                className={`module-card ${selectedAgent === a.id ? 'module-card-active' : ''}`}
                onClick={() => {
                  setSelectedAgent(a.id)
                  onSelectModule(moduleKeyByAgent[a.id])
                  setLogs((p) => [{ id: logCounter.current++, text: `${a.name} launch request to ${moduleByAgent[a.id]}.` }, ...p].slice(0, 8))
                }}
              >
                <b style={{ color: a.color }}>{a.name}</b>
                <span>{moduleByAgent[a.id]}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
