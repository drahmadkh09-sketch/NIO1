import { useState } from 'react'
import CommandCenter from './components/CommandCenter'
import PipelineStudio from './components/PipelineStudio'

export type PipelineModuleKey = 'template' | 'analyzer' | 'rules' | 'components' | 'layouts' | 'export'

export default function App() {
  const [tab, setTab] = useState<'center' | 'pipeline'>('center')
  const [activeModule, setActiveModule] = useState<PipelineModuleKey>('template')
  const [automationSignal, setAutomationSignal] = useState(0)

  const openModuleFromAgent = (moduleKey: PipelineModuleKey) => {
    setActiveModule(moduleKey)
    setTab('pipeline')
    setAutomationSignal((x) => x + 1)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Nio Intelligence Agent Command Centre</h1>
          <p>AI-powered design intelligence cockpit with live automation pipeline</p>
        </div>
        <div className="metrics">
          <button className={`tab-btn ${tab === 'center' ? 'active' : ''}`} onClick={() => setTab('center')}>3D Center</button>
          <button className={`tab-btn ${tab === 'pipeline' ? 'active' : ''}`} onClick={() => setTab('pipeline')}>Pipeline Studio</button>
        </div>
      </header>

      {tab === 'center' ? (
        <CommandCenter onSelectModule={openModuleFromAgent} />
      ) : (
        <PipelineStudio activeModule={activeModule} automationSignal={automationSignal} />
      )}
    </main>
  )
}
