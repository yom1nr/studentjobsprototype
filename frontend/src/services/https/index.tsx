import type { ApiEnvelope } from '../../interface/IApiInterface'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8088'

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return (fromEnv && fromEnv.trim().length > 0 ? fromEnv : DEFAULT_BASE_URL).replace(/\/$/, '')
}

export class ApiError extends Error {
  status: number
  detail?: string

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export async function apiFetch<T>(
  path: string,
  options?: {
    method?: string
    token?: string | null
    body?: unknown
    signal?: AbortSignal
  },
): Promise<T> {
  const method = options?.method ?? 'GET'

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let body: string | undefined

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body,
    signal: options?.signal,
  })

  // No Content
  if (res.status === 204) {
    return undefined as T
  }

  let json: ApiEnvelope<T> | undefined

  try {
    json = (await res.json()) as ApiEnvelope<T>
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message =
      json && 'success' in json && json.success === false
        ? json.error.message
        : `Request failed (${res.status})`

    const detail =
      json && 'success' in json && json.success === false
        ? json.error.detail
        : undefined

    throw new ApiError(message, res.status, detail)
  }

  if (!json || !('success' in json) || json.success !== true) {
    throw new ApiError('Unexpected API response', res.status)
  }

  return json.data
}