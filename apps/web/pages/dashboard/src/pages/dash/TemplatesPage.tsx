import { useEffect, useState, useRef } from 'react'
import { skusApi } from '@/api/client'
import type { SKU } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Upload, Loader2 } from 'lucide-react'
import { BASE_URL } from '@/api/client'

export default function TemplatesPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    skusApi.list().then(setSkus).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/api/v1/docgen/skus/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        load()
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setError(json.error ?? 'Upload failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setUploading(false)
  }

  async function toggleActive(sku: SKU) {
    try {
      if (sku.isActive) {
        await skusApi.unpublish(sku.id)
      } else {
        await skusApi.publish(sku.id)
      }
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleDelete(sku: SKU) {
    if (!confirm(`Delete SKU "${sku.name}"?`)) return
    try {
      await skusApi.delete(sku.id)
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SKU Studio</h1>
          <p className="text-sm text-muted-foreground">Upload templates — AI extracts fields — agents sell them</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept=".docx" ref={fileRef} className="text-sm max-w-40" />
          <Button onClick={handleUpload} disabled={uploading} size="sm">
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? 'Uploading...' : 'Upload Template'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {skus.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No templates uploaded yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {skus.map(sku => (
            <Card key={sku.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Package className="h-5 w-5 mt-0.5 text-indigo-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sku.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{sku.slug}</Badge>
                        <Badge className={sku.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                          {sku.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{sku.currency} {sku.price}</Badge>
                      </div>
                      {sku.description && <p className="text-xs text-muted-foreground mt-1">{sku.description}</p>}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{sku.fieldSchema.length} fields</span>
                        <span>·</span>
                        <span>v{sku.version}</span>
                        <span>·</span>
                        <span>{sku.templateType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(sku)}>
                      {sku.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(sku)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
