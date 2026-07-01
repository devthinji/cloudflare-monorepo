import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type SettingsSection = 'overview' | 'whatsapp' | 'mpesa' | 'platform'
export const DEFAULT_SECTION: SettingsSection = 'overview'

interface SectionMeta {
  id: SettingsSection
  label: string
  icon: LucideIcon
  group: 'top' | 'integrations' | 'platform'
}

import { LayoutDashboard, MessageSquare, CreditCard, Settings } from 'lucide-react'

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview:  { id: 'overview',  label: 'Overview',    icon: LayoutDashboard, group: 'top' },
  whatsapp:  { id: 'whatsapp',  label: 'WhatsApp',     icon: MessageSquare,  group: 'integrations' },
  mpesa:     { id: 'mpesa',     label: 'M-Pesa',       icon: CreditCard,     group: 'integrations' },
  platform:  { id: 'platform',  label: 'Platform',     icon: Settings,       group: 'platform' },
}

const SECTIONS: SettingsSection[] = ['overview', 'whatsapp', 'mpesa', 'platform']
const GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null,           group: 'top' },
  { label: 'Integrations', group: 'integrations' },
  { label: 'Workspace',    group: 'platform' },
]

export function SettingsRail({
  active,
  onSelect,
}: {
  active: SettingsSection
  onSelect: (section: SettingsSection) => void
}) {
  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        'flex gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'border-b border-border',
        'lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0',
      )}
    >
      {GROUPS.map(({ label, group }) => {
        const items = SECTIONS.filter(s => SECTION_META[s].group === group)
        return (
          <div key={group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
            {label && (
              <div className="hidden px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase lg:block">
                {label}
              </div>
            )}
            {items.map(s => {
              const meta = SECTION_META[s]
              const Icon = meta.icon
              const isActive = s === active
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors',
                    'lg:w-full',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{meta.label}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
