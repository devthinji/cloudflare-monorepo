import { useCallback, useState } from 'react'
import type { VisualBlueprint } from '../types'

const GATEWAY_URL = 'http://localhost:8787'

export function useBlueprintLoad() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return useCallback(
    async (agentSlug: string, version: number): Promise<VisualBlueprint | null> => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${GATEWAY_URL}/api/v1/machine/blueprint/${agentSlug}/${version}`)
        const data = (await res.json()) as { success: boolean; data?: VisualBlueprint | null }
        if (!data.success || !data.data) return null
        return data.data
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load blueprint')
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )
}

export function useBlueprintSave() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return useCallback(
    async (agentSlug: string, version: number, blueprint: VisualBlueprint): Promise<boolean> => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(`${GATEWAY_URL}/api/v1/machine/blueprint/${agentSlug}/${version}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
          },
          body: JSON.stringify(blueprint),
        })
        const data = (await res.json()) as { success: boolean }
        if (!data.success) throw new Error('Save failed')
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save blueprint'
        setError(msg)
        return false
      } finally {
        setSaving(false)
      }
    },
    [],
  )
}
