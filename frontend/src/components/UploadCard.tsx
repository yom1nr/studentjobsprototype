import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../services/https'
import { uploadFile } from '../services/https/upload'

const colors = { navy: '#000349' }

export function UploadCard({
  label,
  camera,
  onUpload,
  value,
}: Readonly<{ label: string; camera?: boolean; onUpload?: (url: string) => void; value?: string }>) {
  const { token } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    setError(null)
    try {
      const url = await uploadFile(token, file)
      onUpload?.(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'อัปโหลดล้มเหลว')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <Box>
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.75 }}>{label}</Typography>
      <Box
        component="label"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 1,
          border: '1.5px dashed #B9C6DC',
          borderRadius: 3,
          p: 3,
          cursor: uploading ? 'default' : 'pointer',
          bgcolor: value ? '#F0F8FF' : 'transparent',
          '&:hover': { bgcolor: uploading ? 'transparent' : '#F7FAFF' },
        }}
      >
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          hidden
          disabled={uploading}
          onChange={(e) => void handleFileChange(e)}
        />
        {uploading ? (
          <CircularProgress size={32} sx={{ color: colors.navy }} />
        ) : camera ? (
          <PhotoCameraOutlinedIcon sx={{ color: value ? '#0088FF' : colors.navy, fontSize: 32 }} />
        ) : (
          <CloudUploadOutlinedIcon sx={{ color: value ? '#0088FF' : colors.navy, fontSize: 32 }} />
        )}
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: value ? '#0088FF' : colors.navy }}>
          {uploading ? 'กำลังอัปโหลด...' : value ? 'อัปโหลดสำเร็จ (คลิกเพื่อเปลี่ยน)' : 'คลิกเพื่อเลือกไฟล์'}
        </Typography>
        {!uploading && !value && (
          <Typography sx={{ fontSize: 11, color: '#9AA0A6' }}>รองรับ JPG, PNG, WebP, PDF (ไม่เกิน 5MB)</Typography>
        )}
        {error && <Typography sx={{ fontSize: 11, color: '#DA1E28' }}>{error}</Typography>}
      </Box>
    </Box>
  )
}
