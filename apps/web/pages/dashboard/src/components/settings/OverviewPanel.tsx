import { useEffect, useState } from 'react'
import { agentsApi, customersApi, documentsApi, transactionsApi, type Agent, type Customer, type Document, type Transaction } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Bot, Users, FileText, CreditCard, Loader2 } from 'lucide-react'

export default function OverviewPanel() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      agentsApi.list().catch(() => []),
      customersApi.list().catch(() => []),
      documentsApi.listAll().catch(() => []),
      transactionsApi.listAll().catch(() => []),
    ]).then(([a, c, d, t]) => {
      setAgents(a)
      setCustomers(c)
      setDocs(d)
      setTxns(t)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    )
  }

  const stats = [
    { label: 'Agents', value: agents.length, icon: Bot, color: 'text-blue-500' },
    { label: 'Customers', value: customers.length, icon: Users, color: 'text-green-500' },
    { label: 'Documents', value: docs.length, icon: FileText, color: 'text-amber-500' },
    { label: 'Transactions', value: txns.length, icon: CreditCard, color: 'text-purple-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Settings overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform integrations and workspace configuration.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`size-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Use the sidebar to configure WhatsApp credentials, M-Pesa settings, and platform options.
      </p>
    </div>
  )
}
