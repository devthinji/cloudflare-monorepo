import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { BASE_URL } from '@/api/client'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEV_ADMIN = { email: 'admin@admin.com', password: 'root', name: 'Admin' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Try register first (safe if user already exists — gateway returns 409)
    try {
      await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Admin' }),
      })
    } catch { /* ignore register failure */ }

    // Then login
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
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
