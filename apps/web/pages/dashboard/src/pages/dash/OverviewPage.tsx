import { useEffect, useState } from 'react'
import { agentsApi, skusApi, customersApi, documentsApi } from '@/api/client'
import type { Agent, SKU, Customer, Document } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Package, Users, FileText, Loader2 } from 'lucide-react'

export default function OverviewPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      agentsApi.list().catch(() => []),
      skusApi.list().catch(() => []),
      customersApi.list().catch(() => []),
      documentsApi.listAll().catch(() => []),
    ]).then(([a, s, c, d]) => {
      setAgents(a)
      setSkus(s)
      setCustomers(c)
      setDocs(d)
    }).catch(e => setError(e.message))
     .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
  if (error) return <div className="text-red-600 py-12">Failed to load: {error}</div>

  const activeSkus = skus.filter(s => s.isActive)
  const recentDocs = docs.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform health at a glance</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 p-4 pb-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{agents.length}</p>
            <p className="text-xs text-muted-foreground">{agents.filter(a => a.isActive).length} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 p-4 pb-2">
            <Package className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-sm font-medium">SKUs</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{skus.length}</p>
            <p className="text-xs text-muted-foreground">{activeSkus.length} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 p-4 pb-2">
            <Users className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground">{customers.filter(c => c.registered).length} registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 p-4 pb-2">
            <FileText className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold">{docs.length}</p>
            <p className="text-xs text-muted-foreground">generated</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No documents yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map(d => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">{d.title}</td>
                    <td className="py-2 text-muted-foreground">{d.agentSlug}</td>
                    <td className="py-2 text-muted-foreground">{d.userId}</td>
                    <td className="py-2 text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
