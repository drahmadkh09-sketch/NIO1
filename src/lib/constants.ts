import type { Agent, Station } from './types'

export const ROOM = { width: 900, height: 600 }

export const STATIONS: Station[] = [
  { id: 'planning', name: 'Planning Station', icon: 'Calendar', color: '#3b82f6', x: 150, y: 150 },
  { id: 'analytics', name: 'Analytics Hub', icon: 'BarChart3', color: '#10b981', x: 450, y: 200 },
  { id: 'code', name: 'Code Terminal', icon: 'Code', color: '#8b5cf6', x: 750, y: 180 },
  { id: 'support', name: 'Support Console', icon: 'Headset', color: '#f59e0b', x: 250, y: 450 },
  { id: 'research', name: 'Research Lab', icon: 'BookOpen', color: '#ec4899', x: 550, y: 480 },
  { id: 'command', name: 'Command Node', icon: 'Network', color: '#06b6d4', x: 800, y: 500 },
]

export const AGENTS: Agent[] = [
  { id: 'atlas', name: 'Atlas', role: 'Schedule Manager', color: '#3b82f6', x: 150, y: 150, status: 'working', task: 'Coordinating team meetings' },
  { id: 'sage', name: 'Sage', role: 'Data Analyst', color: '#10b981', x: 450, y: 200, status: 'thinking', task: 'Analyzing performance metrics' },
  { id: 'cipher', name: 'Cipher', role: 'Code Reviewer', color: '#8b5cf6', x: 750, y: 180, status: 'working', task: 'Reviewing pull request #247' },
  { id: 'echo', name: 'Echo', role: 'Customer Support', color: '#f59e0b', x: 250, y: 450, status: 'idle', task: 'Monitoring support queue' },
  { id: 'nova', name: 'Nova', role: 'Research Assistant', color: '#ec4899', x: 550, y: 480, status: 'working', task: 'Gathering market insights' },
  { id: 'nexus', name: 'Nexus', role: 'Task Orchestrator', color: '#06b6d4', x: 800, y: 500, status: 'collaborating', task: 'Optimizing workflow pipelines' },
]
