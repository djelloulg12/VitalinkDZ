import { User } from './types'

const TOKEN_KEY = 'vdz_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function base(): string {
  const C = (window as any).Capacitor
  if (C && C.isNativePlatform && C.isNativePlatform()) {
    return localStorage.getItem('vdz_api') || (import.meta as any).env?.VITE_API || 'http://10.0.2.2:8100'
  }
  return ''
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${base()}/api${path}`, { ...opts, headers })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `خطأ ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data as T
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const res = await api<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(res.token)
  return res
}