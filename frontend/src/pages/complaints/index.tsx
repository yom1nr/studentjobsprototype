import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'
import { ErrorAlert } from '../../components/ErrorAlert'
import { ApiError } from '../../services/https'
import {
  addComplaintAttachment,
  addComplaintHistory,
  createComplaint,
  listAllComplaints,
  listMyComplaints,
} from '../../services/https/complaints'
import type { Complaint, ComplaintActionRole, ComplaintHistoryEntry, ComplaintStatus } from '../../interface/IComplaintInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

const complaintTypes = ['นายจ้าง', 'การจ้างงาน', 'สถานที่ทำงาน', 'ประกาศรับสมัครงาน', 'ระบบการใช้งาน', 'อื่น ๆ']

const statusMap: Record<ComplaintStatus, { label: string; color: string; bg: string; dot: string }> = {
  submitted: { label: 'รอดำเนินการ', color: '#B5850C', bg: '#FFF6E0', dot: '#F1A33C' },
  in_review: { label: 'กำลังดำเนินการ', color: '#0F62FE', bg: '#EFF6FF', dot: '#0F62FE' },
  resolved: { label: 'เสร็จสิ้น', color: '#217829', bg: '#EAF7EA', dot: '#2E9E3B' },
}

const roleLabel: Record<ComplaintActionRole, string> = {
  student: 'นักศึกษา',
  employer: 'ผู้ประกอบการ',
  admin: 'เจ้าหน้าที่ระบบ',
  system: 'ระบบ',
}

const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

function complaintCode(id: number): string {
  return `C${String(id).padStart(3, '0')}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function InfoField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: colors.navy }}>{value}</Typography>
    </Box>
  )
}

function HistoryTimeline({ histories }: Readonly<{ histories: ComplaintHistoryEntry[] }>) {
  return (
    <Box>
      {histories.map((h, index) => (
        <Box key={h.id} sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: statusMap[h.status].dot, flexShrink: 0, mt: 0.5 }} />
            {index < histories.length - 1 && <Box sx={{ width: '1px', flex: 1, bgcolor: colors.border, mt: 0.5 }} />}
          </Box>
          <Box sx={{ flex: 1, pb: index < histories.length - 1 ? 2.5 : 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: statusMap[h.status].color }}>{statusMap[h.status].label}</Typography>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>{formatDateTime(h.timestamp)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: '#697077', mb: 0.5 }}>
              โดย <Box component="span" sx={{ color: '#0F62FE', fontWeight: 600 }}>{roleLabel[h.action_by_role]}</Box>
            </Typography>
            {h.note && <Typography sx={{ fontSize: 13, color: '#333' }}>{h.note}</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

type MyView = 'list' | 'detail'
type FormStep = 'form' | 'incomplete'

function MyComplaintsView() {
  usePageTitle('แจ้งปัญหา / ร้องเรียน')
  const { token } = useAuth()

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null)
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus[]>([])

  const [view, setView] = useState<MyView>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formStep, setFormStep] = useState<FormStep>('form')
  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState<{ file_name: string; file_size: number }[]>([])
  const [successOpen, setSuccessOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listMyComplaints(token!)
        if (!cancelled) setComplaints(data)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อร้องเรียนไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  function toggleStatusFilter(s: ComplaintStatus) {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const filtered = complaints.filter((c) => {
    const q = search.toLowerCase()
    const matchesSearch = complaintCode(c.id).toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(c.status)
    return matchesSearch && matchesStatus
  })

  function openDetail(id: number) {
    setSelectedId(id)
    setView('detail')
  }

  function closeForm() {
    setFormOpen(false)
    setFormStep('form')
    setTitle('')
    setType('')
    setDescription('')
    setAttachments([])
  }

  async function handleSubmitClick() {
    if (title.trim().length === 0 || type === '' || description.trim().length === 0) {
      setFormStep('incomplete')
      return
    }
    if (!token) return
    setSubmitting(true)
    try {
      const created = await createComplaint(token, { title: title.trim(), description: description.trim(), reference_type: type })
      let finalComplaint = created
      for (const a of attachments) {
        finalComplaint = await addComplaintAttachment(token, created.id, { file_name: a.file_name, file_size: a.file_size })
      }
      setComplaints((prev) => [finalComplaint, ...prev])
      closeForm()
      setSuccessOpen(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งข้อร้องเรียนไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
      setUploadError('ไฟล์ไม่รองรับ กรุณาเลือกไฟล์ PDF, Word, Excel, PowerPoint, Text, JPG, PNG, GIF หรือ WEBP')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError('ขนาดไฟล์เกิน 10 MB กรุณาเลือกไฟล์ใหม่')
      setSelectedFile(null)
      return
    }
    setUploadError(null)
    setSelectedFile(file)
  }

  function closeUploadDialog() {
    setUploadOpen(false)
    setSelectedFile(null)
    setUploadError(null)
  }

  function confirmUpload() {
    if (!selectedFile) return
    setAttachments((prev) => [...prev, { file_name: selectedFile.name, file_size: selectedFile.size }])
    closeUploadDialog()
  }

  const selected = complaints.find((c) => c.id === selectedId) ?? null

  if (loading) {
    return <Box sx={{ maxWidth: 1000, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  if (view === 'detail' && selected) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <ErrorAlert message={error} />
        <Typography sx={{ fontSize: 13, color: '#697077', mb: 1 }}>
          <Box component="span" sx={{ cursor: 'pointer', color: '#0F62FE' }} onClick={() => setView('list')}>ข้อร้องเรียน</Box>
          {' > '}รายละเอียด
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy }}>รายละเอียดข้อร้องเรียน</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: 13, color: '#697077' }}>รหัส {complaintCode(selected.id)}</Typography>
            <Chip label={statusMap[selected.status].label} sx={{ bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 700 }} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
          <Box sx={{ flex: 1, border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ข้อมูลข้อร้องเรียน</Typography>
            <InfoField label="หัวข้อข้อร้องเรียน" value={selected.title} />
            <InfoField label="ประเภทข้อร้องเรียน" value={selected.reference_type} />
            <InfoField label="วันที่แจ้ง" value={formatDateTime(selected.created_at)} />
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>สถานะปัจจุบัน</Typography>
              <Chip label={statusMap[selected.status].label} size="small" sx={{ bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 600 }} />
            </Box>
            <InfoField label="วันอัปเดตล่าสุด" value={formatDateTime(selected.updated_at)} />
            {selected.attachments.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 13, color: '#697077', mb: 1 }}>เอกสารแนบ</Typography>
                {selected.attachments.map((a) => (
                  <Box key={a.file_name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                    <Typography sx={{ fontSize: 13 }}>{a.file_name}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1.3, border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ประวัติการดำเนินการ</Typography>
            <HistoryTimeline histories={selected.histories} />
          </Box>
        </Box>

        {selected.resolution_detail && (
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 1 }}>รายละเอียดผลดำเนินการ</Typography>
            <Typography sx={{ fontSize: 14, color: '#333' }}>{selected.resolution_detail}</Typography>
          </Box>
        )}

        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => { setView('list'); setSelectedId(null) }}
          sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, bgcolor: '#F0F0F0', px: 3, '&:hover': { bgcolor: '#E4E4E4' } }}
        >
          กลับไปยังรายการข้อร้องเรียน
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy }}>ข้อร้องเรียนของฉัน</Typography>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>ติดตามสถานะและผลการดำเนินการของข้อร้องเรียน</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => setFormOpen(true)}
          sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 500, px: 2.5, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
        >
          แจ้งข้อร้องเรียน
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, my: 3 }}>
        <TextField
          placeholder="ค้นหาหัวข้อ หรือ เลขที่ข้อร้องเรียน.."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
        />
        <Button
          variant="outlined"
          startIcon={<TuneOutlinedIcon />}
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, borderColor: '#C4C4C4', px: 3, flexShrink: 0 }}
        >
          ตัวกรอง{statusFilter.length > 0 ? ` (${statusFilter.length})` : ''}
        </Button>
      </Box>

      <Menu anchorEl={filterAnchor} open={!!filterAnchor} onClose={() => setFilterAnchor(null)}>
        <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
          {(Object.keys(statusMap) as ComplaintStatus[]).map((s) => (
            <FormControlLabel
              key={s}
              control={<Checkbox checked={statusFilter.includes(s)} onChange={() => toggleStatusFilter(s)} size="small" />}
              label={statusMap[s].label}
              sx={{ display: 'flex' }}
            />
          ))}
          <Button size="small" onClick={() => setStatusFilter([])} sx={{ textTransform: 'none', mt: 0.5 }}>ล้างตัวกรอง</Button>
        </Box>
      </Menu>

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 130px 130px 56px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
          {['รหัส', 'หัวข้อ', 'ประเภท', 'สถานะ', 'วันที่แจ้ง', ''].map((h) => (
            <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
          ))}
        </Box>
        {filtered.map((c, index) => {
          const status = statusMap[c.status]
          return (
            <Box
              key={c.id}
              onClick={() => openDetail(c.id)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 140px 130px 130px 56px',
                alignItems: 'center',
                px: 2.5,
                py: 1.75,
                borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#FAFBFC' },
              }}
            >
              <Typography sx={{ fontSize: 13, color: '#697077' }}>{complaintCode(c.id)}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 13, color: '#52545C' }}>{c.reference_type}</Typography>
              <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, width: 'fit-content' }} />
              <Typography sx={{ fontSize: 13, color: '#697077' }}>{new Date(c.created_at).toLocaleDateString('th-TH')}</Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(c.id) }} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
              </IconButton>
            </Box>
          )
        })}
        {filtered.length === 0 && (
          <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อร้องเรียนที่ค้นหา</Typography>
        )}
      </Box>
      {filtered.length > 0 && (
        <Typography sx={{ fontSize: 13, color: '#697077', textAlign: 'right', mt: 1 }}>
          1-{filtered.length} จาก {filtered.length} รายการ
        </Typography>
      )}

      {/* Submit form */}
      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3.5 }}>
          {formStep === 'incomplete' ? (
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <Box sx={{ width: 88, height: 88, borderRadius: '50%', bgcolor: '#FDEAEA', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <ErrorOutlineIcon sx={{ fontSize: 44, color: '#DA1E28' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mb: 0.5 }}>ข้อมูลไม่ครบถ้วน</Typography>
              <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งข้อร้องเรียน</Typography>
              <Box sx={{ bgcolor: '#FDEAEA', border: '1px solid #F6C6C6', borderRadius: 3, p: 2.5, textAlign: 'left', mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#DA1E28', mb: 1 }}>กรุณาตรวจสอบข้อมูลต่อไปนี้</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#333' }}>
                  {title.trim().length === 0 && <li>หัวข้อร้องเรียน</li>}
                  {description.trim().length === 0 && <li>รายละเอียดข้อร้องเรียน</li>}
                  {type === '' && <li>ประเภทข้อร้องเรียน</li>}
                </Box>
              </Box>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setFormStep('form')}
                sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                กลับไปแก้ไขข้อมูล
              </Button>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>แจ้งข้อร้องเรียน</Typography>
                <IconButton size="small" onClick={closeForm}><CloseOutlinedIcon /></IconButton>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="หัวข้อร้องเรียน" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth required />
                <TextField select label="ประเภทข้อร้องเรียน" value={type} onChange={(e) => setType(e.target.value)} fullWidth required>
                  {complaintTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField
                  label="รายละเอียดข้อร้องเรียน"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  required
                  multiline
                  minRows={4}
                />

                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mb: 0.5 }}>เอกสารแนบ (ถ้ามี)</Typography>
                  <Box
                    onClick={() => setUploadOpen(true)}
                    sx={{ border: `1.5px dashed ${colors.border}`, borderRadius: 2, p: 2, textAlign: 'center', cursor: 'pointer', color: '#9AA0A6' }}
                  >
                    {attachments.length === 0 ? (
                      <Typography sx={{ fontSize: 12 }}>รองรับไฟล์ PDF, Word, Excel, PowerPoint, JPG, PNG (ขนาดไม่เกิน 10MB)</Typography>
                    ) : (
                      attachments.map((a) => (
                        <Box key={a.file_name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          <InsertDriveFileOutlinedIcon fontSize="small" />
                          <Typography sx={{ fontSize: 13, color: colors.navy }}>{a.file_name}</Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="contained"
                disabled={submitting}
                onClick={() => void handleSubmitClick()}
                sx={{ mt: 3, height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                {submitting ? 'กำลังส่ง...' : 'ส่งข้อร้องเรียน'}
              </Button>
            </>
          )}
        </Box>
      </Dialog>

      {/* Attachment upload modal */}
      <Dialog open={uploadOpen} onClose={closeUploadDialog} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>อัปโหลดเอกสาร</Typography>
            <IconButton size="small" onClick={closeUploadDialog}><CloseOutlinedIcon /></IconButton>
          </Box>

          {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}

          <Box
            component="label"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#F5F5F5',
              borderRadius: 3,
              height: 180,
              cursor: 'pointer',
              mb: 2,
              p: 2,
              textAlign: 'center',
            }}
          >
            <input type="file" hidden onChange={handleFileSelect} accept={ALLOWED_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',')} />
            <Box sx={{ width: 56, height: 56, borderRadius: 2, border: `2px solid ${colors.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AddOutlinedIcon sx={{ color: colors.navy }} />
            </Box>
            {selectedFile && (
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mt: 1.5, wordBreak: 'break-all' }}>
                {selectedFile.name}
              </Typography>
            )}
          </Box>

          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mb: 0.5 }}>รองรับไฟล์:</Typography>
          <Typography sx={{ fontSize: 12, color: '#333' }}>
            • เอกสาร: PDF (.pdf), Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), Text (.txt)
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#333', mb: 2 }}>
            • รูปภาพ: JPG (.jpg, .jpeg), PNG (.png), GIF (.gif), WEBP (.webp)
            <br />
            ขนาดไฟล์ไม่เกิน 10 MB
          </Typography>

          <Button
            fullWidth
            variant="contained"
            onClick={confirmUpload}
            disabled={!selectedFile}
            sx={{ height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            อัปโหลด
          </Button>
        </Box>
      </Dialog>

      {/* Success */}
      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton onClick={() => setSuccessOpen(false)} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}><CloseOutlinedIcon /></IconButton>
          <CheckCircleOutlineIcon sx={{ fontSize: 88, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mt: 1 }}>ได้รับเรื่องร้องเรียนเรียบร้อย</Typography>
        </Box>
      </Dialog>
    </Box>
  )
}

const ADMIN_TABS: { key: 'all' | ComplaintStatus; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'submitted', label: 'รอดำเนินการ' },
  { key: 'in_review', label: 'กำลังดำเนินการ' },
  { key: 'resolved', label: 'เสร็จสิ้น' },
]

function AdminComplaintsView() {
  usePageTitle('จัดการข้อร้องเรียน')
  const { token } = useAuth()

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | ComplaintStatus>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>('in_review')
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listAllComplaints(token!)
        if (!cancelled) setComplaints(data)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อร้องเรียนไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  const filtered = complaints.filter((c) => {
    const q = search.toLowerCase()
    const matchesSearch = complaintCode(c.id).toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.submitter_name.toLowerCase().includes(q)
    const matchesTab = tab === 'all' || c.status === tab
    return matchesSearch && matchesTab
  })

  const selected = complaints.find((c) => c.id === selectedId) ?? null

  function openDetail(c: Complaint) {
    setSelectedId(c.id)
    setNextStatus(c.status === 'submitted' ? 'in_review' : 'resolved')
    setNote('')
    setActionError(null)
  }

  async function submitUpdate() {
    if (!selected || !token) return
    if (note.trim().length === 0) {
      setActionError('กรุณาระบุหมายเหตุการดำเนินการ')
      return
    }
    setSubmitting(true)
    try {
      const updated = await addComplaintHistory(token, selected.id, { status: nextStatus, note: note.trim() })
      setComplaints((prev) => prev.map((c) => (c.id === selected.id ? updated : c)))
      setSelectedId(null)
    } catch (err) {
      setActionError(apiErrorMessage(err, 'บันทึกผลไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Box sx={{ maxWidth: 1100, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 0.5 }}>จัดการข้อร้องเรียน</Typography>
      <Typography sx={{ fontSize: 13, color: '#697077', mb: 3 }}>ตรวจสอบและดำเนินการข้อร้องเรียนจากนักศึกษาและผู้ประกอบการ</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {ADMIN_TABS.map((t) => (
          <Button
            key={t.key}
            onClick={() => setTab(t.key)}
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
              px: 2.5,
              bgcolor: tab === t.key ? colors.navy : '#F0F0F0',
              color: tab === t.key ? '#fff' : colors.navy,
              '&:hover': { bgcolor: tab === t.key ? colors.navy : '#E4E4E4' },
            }}
          >
            {t.label}
          </Button>
        ))}
      </Box>

      <TextField
        placeholder="ค้นหาหัวข้อ ผู้แจ้ง หรือ เลขที่ข้อร้องเรียน.."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
      />

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '70px 1fr 150px 120px 120px 110px 56px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
          {['เลขที่', 'หัวข้อ', 'ผู้แจ้ง', 'ประเภท', 'สถานะ', 'วันที่แจ้ง', ''].map((h) => (
            <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
          ))}
        </Box>
        {filtered.map((c, index) => {
          const status = statusMap[c.status]
          return (
            <Box
              key={c.id}
              onClick={() => openDetail(c)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr 150px 120px 120px 110px 56px',
                alignItems: 'center',
                px: 2.5,
                py: 1.75,
                borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#FAFBFC' },
              }}
            >
              <Typography sx={{ fontSize: 13, color: '#697077' }}>{complaintCode(c.id)}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 13, color: '#52545C' }}>{c.submitter_name}</Typography>
              <Typography sx={{ fontSize: 13, color: '#52545C' }}>{c.reference_type}</Typography>
              <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, width: 'fit-content' }} />
              <Typography sx={{ fontSize: 13, color: '#697077' }}>{new Date(c.created_at).toLocaleDateString('th-TH')}</Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(c) }} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
              </IconButton>
            </Box>
          )
        })}
        {filtered.length === 0 && (
          <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อร้องเรียน</Typography>
        )}
      </Box>

      <Dialog open={!!selected} onClose={() => setSelectedId(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {selected && (
          <Box sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>{complaintCode(selected.id)} · {selected.title}</Typography>
              <IconButton size="small" onClick={() => setSelectedId(null)}><CloseOutlinedIcon /></IconButton>
            </Box>

            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 1, columnGap: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 600, color: colors.navy, fontSize: 13 }}>ผู้แจ้ง</Typography>
              <Typography sx={{ fontSize: 13 }}>{selected.submitter_name}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy, fontSize: 13 }}>ประเภท</Typography>
              <Typography sx={{ fontSize: 13 }}>{selected.reference_type}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy, fontSize: 13 }}>สถานะ</Typography>
              <Chip size="small" sx={{ justifySelf: 'start', bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 600 }} label={statusMap[selected.status].label} />
            </Box>
            <Typography sx={{ fontSize: 13, color: '#333', mb: 2 }}>{selected.description}</Typography>

            {selected.attachments.length > 0 && (
              <Box sx={{ mb: 2 }}>
                {selected.attachments.map((a) => (
                  <Box key={a.file_name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                    <Typography sx={{ fontSize: 13 }}>{a.file_name}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1.5 }}>ประวัติการดำเนินการ</Typography>
            <Box sx={{ mb: 2.5, maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
              <HistoryTimeline histories={selected.histories} />
            </Box>

            {selected.status !== 'resolved' && (
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1.5 }}>บันทึกผลการดำเนินการ</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField select size="small" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ComplaintStatus)}>
                    <MenuItem value="in_review">กำลังดำเนินการ</MenuItem>
                    <MenuItem value="resolved">เสร็จสิ้น</MenuItem>
                  </TextField>
                  <TextField
                    label="หมายเหตุ"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <Button
                    variant="contained"
                    disabled={submitting}
                    onClick={() => void submitUpdate()}
                    sx={{ alignSelf: 'flex-end', borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
                  >
                    บันทึก
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Dialog>
    </Box>
  )
}

export default function ComplaintsPage() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <AdminComplaintsView />
  return <MyComplaintsView />
}
