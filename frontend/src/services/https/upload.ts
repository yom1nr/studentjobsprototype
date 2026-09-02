
type UploadResponse = {
  url: string
}

export function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  // Use the underlying fetch directly to avoid the default JSON content-type
  // configured in our apiFetch wrapper for standard requests.
  return fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/v1/upload`, {
    method: 'POST',
    body: formData,
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Upload failed')
      }
      return res.json() as Promise<{ data: UploadResponse }>
    })
    .then((res) => res.data.url)
}
