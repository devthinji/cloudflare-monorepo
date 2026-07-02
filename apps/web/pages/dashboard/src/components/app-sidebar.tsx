import type { ReactNode } from 'react'
import {
  LayoutDashboard, Bot, MessageSquare, FileText, CreditCard, Settings, Package, GitBranch, FileStack,
} from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { NavAgents } from '@/components/nav-agents'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

const PLATFORM_NAV = [
  { title: 'Overview',      url: '/',              icon: <LayoutDashboard />, end: true },
  { title: 'Conversations', url: '/conversations',  icon: <MessageSquare /> },
  { title: 'Documents',     url: '/documents',      icon: <FileText /> },
  { title: 'Transactions',  url: '/transactions',   icon: <CreditCard /> },
  { title: 'Workflow',      url: '/workflow',       icon: <GitBranch /> },
]

const CONFIG_NAV = [
  { title: 'Agents',    url: '/agents',    icon: <Bot /> },
  { title: 'Templates', url: '/templates', icon: <Package /> },
  { title: 'Settings',  url: '/settings',  icon: <Settings /> },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Page-specific content injected below the standard nav — used by the Workflow page's node palette. */
  extra?: ReactNode
}

export function AppSidebar({ extra, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileStack className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Taji &amp; Elim</span>
                <span className="truncate text-xs text-muted-foreground">Platform Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Platform" items={PLATFORM_NAV} />
        <NavAgents />
        <NavMain label="Configuration" items={CONFIG_NAV} />
        {extra}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
