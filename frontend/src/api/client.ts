import { supabase } from '../lib/supabase'

export const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function backendPost(path: string, body?: Record<string, any>): Promise<any> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function backendGet(path: string): Promise<any> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}${path}`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function backendPut(path: string, body?: Record<string, any>): Promise<any> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function backendDelete(path: string): Promise<any> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}${path}`, { method: 'DELETE', headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend error ${res.status}: ${text}`)
  }
  return res.json()
}
