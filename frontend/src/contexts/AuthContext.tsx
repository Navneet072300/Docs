'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '@/lib/api'

interface User {
  id: string
  email: string
  name: string
  avatar_color?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
  }

  const register = async (email: string, password: string, name: string) => {
    const data = await api.post('/auth/register', { email, password, name })
    localStorage.setItem('token', data.token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
