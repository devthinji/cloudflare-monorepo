import { useEffect, useState } from 'react'
import { transactionsApi } from '@/api/client'
import type { Transaction } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CreditCard, RefreshCw, Loader2 } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-600',
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  function load() {
    setLoading(true)
    transactionsApi.listAll()
      .then(setTxs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const counts = {
    all: txs.length,
    completed: txs.filter(t => t.status === 'completed').length,
    pending: txs.filter(t => t.status === 'pending').length,
    failed: txs.filter(t => t.status === 'failed').length,
  }

  const filtered = filter === 'all' ? txs : txs.filter(t => t.status === filter)

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">M-Pesa payments via Daraja API</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All <span className="text-xs ml-1 text-muted-foreground">({counts.all})</span></TabsTrigger>
          <TabsTrigger value="completed">Completed <span className="text-xs ml-1 text-muted-foreground">({counts.completed})</span></TabsTrigger>
          <TabsTrigger value="pending">Pending <span className="text-xs ml-1 text-muted-foreground">({counts.pending})</span></TabsTrigger>
          <TabsTrigger value="failed">Failed <span className="text-xs ml-1 text-muted-foreground">({counts.failed})</span></TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No {filter === 'all' ? '' : filter} transactions.</CardContent></Card>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Amount</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">User</th>
                    <th className="p-3 font-medium">Agent</th>
                    <th className="p-3 font-medium">Receipt</th>
                    <th className="p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs">{t.id.slice(0, 12)}…</td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {t.currency} {t.amount}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={STATUS_STYLE[t.status] ?? ''}>{t.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{t.userId}</td>
                      <td className="p-3"><Badge variant="secondary" className="text-[10px]">{t.agentSlug}</Badge></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{t.mpesaReceiptNumber ?? '—'}</td>
                      <td className="p-3 text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
