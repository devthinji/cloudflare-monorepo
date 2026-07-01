import { useEffect, useState } from 'react'
import { documentsApi } from '@/api/client'
import type { Document } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, RefreshCw, Loader2 } from 'lucide-react'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    documentsApi.listAll()
      .then(setDocs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">All generated documents across all users</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {docs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No documents generated yet.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Agent</th>
                  <th className="p-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {docs.map(d => (
                  <tr key={d.id} className="hover:bg-muted/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{d.title}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{d.type}</td>
                    <td className="p-4 text-muted-foreground">{d.userId}</td>
                    <td className="p-4"><Badge variant="secondary" className="text-[10px]">{d.agentSlug}</Badge></td>
                    <td className="p-4 text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
