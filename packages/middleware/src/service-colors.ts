import { magenta, cyan, yellow, green, blue, white } from './colors'

export interface ServiceStyle {
  tag: string
  icon: string
  color: (s: string) => string
  hex: string
}

const registry: Record<string, ServiceStyle> = {
  gateway:   { tag: 'GATEWAY', icon: '🛠️',  color: magenta, hex: '#FF6AC1' },
  agent:     { tag: 'AGENTS',  icon: '🧠',  color: cyan,    hex: '#56E1E9' },
  docgen:    { tag: 'DOCGEN',  icon: '📄',  color: yellow,  hex: '#F4D35E' },
  whatsapp:  { tag: 'WA',      icon: '💬',  color: green,   hex: '#5AF78E' },
  dashboard: { tag: 'DASH',    icon: '🖥️',  color: blue,    hex: '#5A9CF8' },
}

export function getServiceStyle(service: string): ServiceStyle {
  return registry[service] ?? { tag: service.toUpperCase(), icon: '⚙️', color: white, hex: '#FFFFFF' }
}

export function getTagWidth(): number {
  const tags = Object.values(registry).map(s => s.tag.length)
  return Math.max(...tags)
}
