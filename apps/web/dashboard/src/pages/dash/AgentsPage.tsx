import { useState } from 'react'
import { Bot, Plus, Pencil, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react'

interface Agent {
  id:            string
  name:          string
  slug:          string
  description:   string
  modelProvider: string
  modelId:       string
  channel:       string
  isActive:      boolean
}

const MOCK: Agent[] = [
  {
    id: '1', name: 'Taji', slug: 'taji',
    description: 'Career document agent — CVs, application & resignation letters',
    modelProvider: 'groq', modelId: 'llama-3.3-70b-versatile',
    channel: 'whatsapp', isActive: true,
  },
  {
    id: '2', name: 'Elim', slug: 'elim',
    description: 'CBC education agent for Kenyan students, parents & teachers',
    modelProvider: 'groq', modelId: 'llama-3.3-70b-versatile',
    channel: 'whatsapp', isActive: true,
  },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(MOCK)
  const [selected, setSelected] = useState<Agent | null>(null)

  function toggle(id: string) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your AI agents</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelected(agent)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${agent.slug === 'taji' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                  <Bot size={20} className={agent.slug === 'taji' ? 'text-blue-600' : 'text-purple-600'} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                  <span className="text-xs text-gray-400 font-mono">/{agent.slug}</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggle(agent.id) }}
                className={`transition-colors ${agent.isActive ? 'text-emerald-500' : 'text-gray-300'}`}
              >
                {agent.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-3">{agent.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-mono">{agent.modelId}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{agent.channel}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                agent.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {agent.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); setSelected(agent) }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Pencil size={12} /> Edit <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Side panel placeholder */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-1">{selected.name}</h2>
            <p className="text-sm text-gray-500 mb-6">{selected.description}</p>

            {[
              { label: 'Slug',     value: selected.slug },
              { label: 'Model',    value: selected.modelId },
              { label: 'Provider', value: selected.modelProvider },
              { label: 'Channel',  value: selected.channel },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-3 border-b border-gray-100 text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-mono text-gray-800">{row.value}</span>
              </div>
            ))}

            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
