import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { BASE_URL } from '@/api/client'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  verifying: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [verifying, setVerifying] = useState(true)

  // Validate stored token on mount — if stale, redirect to login
  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (!stored) {
      setVerifying(false)
      return
    }
    fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(json => {
        if (json.success) {
          setToken(stored)
        } else {
          throw new Error()
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setVerifying(false))
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Admin' }),
      })
    } catch { /* ignore register failure */ }

    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (json.success && json.data?.token) {
        localStorage.setItem('token', json.data.token)
        setToken(json.data.token)
        return true
      }
    } catch { /* login failed */ }

    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, verifying, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
