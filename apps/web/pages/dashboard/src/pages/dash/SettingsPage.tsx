import { useState, type ReactNode } from 'react'
import { SettingsRail, type SettingsSection } from '@/components/settings/SettingsRail'
import WhatsAppConfig from '@/components/settings/WhatsAppConfig'
import OverviewPanel from '@/components/settings/OverviewPanel'
import MpesaPanel from '@/components/settings/MpesaPanel'
import PlatformPanel from '@/components/settings/PlatformPanel'

const panel: Record<SettingsSection, ReactNode> = {
  overview:  <OverviewPanel />,
  whatsapp:  <WhatsAppConfig />,
  mpesa:     <MpesaPanel />,
  platform:  <PlatformPanel />,
}

export default function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('overview')

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything in one place — integrations and platform configuration.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={setSection} />
        <div className="min-w-0">{panel[section]}</div>
      </div>
    </div>
  )
}
