import { useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/':              'Overview',
  '/agents':        'Agents',
  '/conversations': 'Conversations',
  '/documents':     'Documents',
  '/transactions':  'Transactions',
  '/templates':     'Templates',
  '/workflow':      'Workflow',
  '/settings':      'Settings',
}

// Routes that manage their own layout/scrolling (e.g. full-bleed canvases).
const FULL_BLEED_ROUTES = new Set(['/workflow'])

export interface AppShellContext {
  setSidebarExtra: (node: ReactNode | null) => void
}

export default function AppShell() {
  const { pathname } = useLocation()
  const [sidebarExtra, setSidebarExtra] = useState<ReactNode | null>(null)
  const title = PAGE_TITLES[pathname] ?? 'Dashboard'
  const fullBleed = FULL_BLEED_ROUTES.has(pathname)

  return (
    <SidebarProvider>
      <AppSidebar extra={sidebarExtra} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {fullBleed ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <Outlet context={{ setSidebarExtra } satisfies AppShellContext} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet context={{ setSidebarExtra } satisfies AppShellContext} />
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
