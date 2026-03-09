export type AgentStatus = 'idle' | 'working' | 'thinking' | 'collaborating'

export interface Agent {
  id: string
  name: string
  role: string
  color: string
  x: number
  y: number
  status: AgentStatus
  task: string
}

export interface Station {
  id: string
  name: string
  icon: string
  color: string
  x: number
  y: number
}
