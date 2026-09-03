import { ApiError, getApiBaseUrl } from './index'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

type UploadEnvelope = { success: boolean; data?: { url: string }; error?: { message: string; detail?: string } }

/**
 * Uploads one file to POST /api/v1/upload (authenticated) and resolves to the
 * stored URL (e.g. "/uploads/1699..._ab12.png"). Uses raw fetch because the
 * body is multipart/form-data, not the JSON that apiFetch assumes.
 */
export async function uploadFile(token: string, file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError('ไฟล์ใหญ่เกิน 5MB', 400)
  }
  if (file.type && !ACCEPTED.includes(file.type)) {
    throw new ApiError('รองรับเฉพาะ JPG, PNG, WebP, PDF', 400)
  }

  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${getApiBaseUrl()}/api/v1/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  let json: UploadEnvelope | undefined
  try {
    json = (await res.json()) as UploadEnvelope
  } catch {
    /* ignore */
  }

  if (!res.ok || !json?.success || !json.data?.url) {
    const msg = json?.error?.message ?? `อัปโหลดล้มเหลว (${res.status})`
    throw new ApiError(msg, res.status, json?.error?.detail)
  }
  return json.data.url
}
