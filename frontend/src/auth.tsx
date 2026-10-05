import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { User } from './types'
import { api, clearToken, getToken, login as loginApi } from './api'

interface AuthCtx {
  user: User | null
  ready: boolean
  login: (u: string, p: string) => Promise<User>
  logout: () => void
  reloadUser: () => Promise<User>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  login: async () => { throw new Error('no provider') },
  logout: () => {},
  reloadUser: async () => { throw new Error('no provider') },
})

export function useAuth() {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setReady(true)
      return
    }
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const res = await loginApi(u, p)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const reloadUser = useCallback(async () => {
    const u = await api<User>('/auth/me')
    setUser(u)
    return u
  }, [])

  return <Ctx.Provider value={{ user, ready, login, logout, reloadUser }}>{children}</Ctx.Provider>
}

export function useApiData<T>(path: string, refreshKey: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    api<T>(path)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path])

  useEffect(() => {
    reload()
  }, [path, refreshKey, reload])

  return { data, error, loading, reload }
}