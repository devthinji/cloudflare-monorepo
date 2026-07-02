import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { agentsApi, type Agent } from '@/api/client'
import { Bot } from 'lucide-react'

export function NavAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const { pathname, search } = useLocation()

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => setAgents([]))
  }, [])

  if (agents.length === 0) return null

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Agents</SidebarGroupLabel>
      <SidebarMenu>
        {agents.map(agent => {
          const url = `/agents?slug=${agent.slug}`
          const active = pathname === '/agents' && search.includes(agent.slug)
          return (
            <SidebarMenuItem key={agent.id}>
              <SidebarMenuButton isActive={active} render={<Link to={url} />}>
                <Bot />
                <span className="truncate">{agent.name}</span>
                <span
                  className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${
                    agent.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  }`}
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
