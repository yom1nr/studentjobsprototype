import { useState } from 'react'
import { Box, Button, Chip, Dialog, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'

const colors = { navy: '#012150', border: '#DDE1E6' }

type Status = 'pending' | 'accepted' | 'rejected'

const offer = {
  code: 'AG-2569-021',
  position: 'Barista พาร์ทไทม์ — ร้าน Café Doi',
  startDate: '1 ส.ค. 2569',
  duration: '4 เดือน (ถึง 30 พ.ย. 2569)',
  wageRate: '60 บาท / ชั่วโมง',
  workingHours: 'ไม่เกิน 20 ชม./สัปดาห์',
  leavePolicy: 'แจ้งล่วงหน้าอย่างน้อย 3 วัน ยกเว้นกรณีฉุกเฉิน',
  additionalTerms: 'แต่งกายสุภาพตามระเบียบร้าน รักษาความลับของกิจการ',
}

export default function EmploymentPage() {
  usePageTitle('ข้อตกลงการจ้างงาน')
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('pending')
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acceptedDialog, setAcceptedDialog] = useState(false)
  const [rejectedDialog, setRejectedDialog] = useState(false)

  const statusChip = {
    pending: { label: 'รอการตอบรับ', color: '#B5850C', bg: '#FFF0DD' },
    accepted: { label: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
    rejected: { label: 'ปฏิเสธแล้ว', color: '#DA1E28', bg: '#FDEAEA' },
  }[status]

  function accept() {
    setStatus('accepted')
    setAcceptedDialog(true)
  }

  function confirmReject() {
    setStatus('rejected')
    setRejecting(false)
    setRejectedDialog(true)
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
        รายละเอียดข้อตกลงการจ้างงาน
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>
        อ่านและตรวจทานรายละเอียดให้ครบก่อนตอบรับ — เมื่อตอบรับ ข้อตกลงจะมีผลบังคับและถูกจัดเก็บเป็นหลักฐาน
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600 }} />
            <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>ข้อตกลงเลขที่ {offer.code}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mb: 2 }}>{offer.position}</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderTop: `1px solid ${colors.border}`, pt: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>วันเริ่มงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.startDate}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ระยะเวลา</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.duration}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>อัตราค่าตอบแทน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.wageRate}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ชั่วโมงการทำงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.workingHours}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>เงื่อนไขการลางาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.leavePolicy}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ข้อกำหนดอื่น ๆ</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.additionalTerms}</Typography>
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mt: 3, mb: 1 }}>
            มีข้อสงสัย / ขอปรับแก้ประเด็นใด แจ้งผู้ประกอบการ
          </Typography>
          <TextField
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="พิมพ์คำถามหรือประเด็นที่ต้องการให้ชี้แจงก่อนตัดสินใจ..."
            fullWidth
            multiline
            minRows={3}
            disabled={status !== 'pending'}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>การตัดสินใจ</Typography>

            <Box sx={{ display: 'flex', gap: 1, bgcolor: '#FFF0DD', borderRadius: 2, p: 1.5, mb: 2 }}>
              <LockOutlinedIcon fontSize="small" sx={{ color: '#B5850C' }} />
              <Typography sx={{ fontSize: 12, color: '#8A6A1B' }}>ระบบจะให้ยืนยันตัวตนอีกครั้งก่อนบันทึกผลเพื่อความปลอดภัย</Typography>
            </Box>

            {status === 'pending' && !rejecting && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={accept}
                  startIcon={<CheckCircleOutlineIcon />}
                  sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
                >
                  ตอบรับข้อตกลง
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setRejecting(true)}
                  sx={{ borderRadius: '40px', textTransform: 'none', color: '#DA1E28', borderColor: '#DA1E28' }}
                >
                  ปฏิเสธ (ต้องระบุเหตุผล)
                </Button>
              </Box>
            )}

            {status === 'pending' && rejecting && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ปฏิเสธข้อตกลง"
                  multiline
                  minRows={3}
                  fullWidth
                  size="small"
                />
                <Button onClick={() => setRejecting(false)} sx={{ textTransform: 'none', color: colors.navy }}>ยกเลิก</Button>
                <Button
                  variant="contained"
                  disabled={rejectReason.trim().length === 0}
                  onClick={confirmReject}
                  sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
                >
                  ยืนยันการปฏิเสธ
                </Button>
              </Box>
            )}

            {status !== 'pending' && (
              <Typography sx={{ fontSize: 13, color: '#697077' }}>
                คุณได้{status === 'accepted' ? 'ตอบรับ' : 'ปฏิเสธ'}ข้อตกลงนี้แล้ว
              </Typography>
            )}
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1 }}>เมื่อตอบรับ</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.2, fontSize: 13, color: '#333' }}>
              <li>สถานะเปลี่ยนเป็น "มีผลบังคับ"</li>
              <li>จัดเก็บเป็นหลักฐานอ้างอิง</li>
              <li>แจ้งทุกฝ่ายให้รับทราบตรงกัน</li>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Accept confirmation */}
      <Dialog open={acceptedDialog} onClose={() => setAcceptedDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 96, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 26, color: colors.navy, mt: 2 }}>ยืนยันการจ้างงาน</Typography>
          <Typography sx={{ fontSize: 14, color: '#697077', mt: 1.5 }}>
            ขอขอบคุณที่เลือกทำงานกับเราขอบคุณครับ/ค่ะ
            <br />
            สามารถติดตามเวลางานได้ที่เวลาทำงาน
            <br />
            <br />
            หากสงสัยหรือมีคำถามสามารถแจ้งได้ที่แจ้งปัญหา / ร้องเรียน
            <br />
            ขอขอบคุณเป็นอย่างสูง
          </Typography>
        </Box>
      </Dialog>

      {/* Reject confirmation */}
      <Dialog open={rejectedDialog} onClose={() => setRejectedDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 64 }}>😢</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 26, color: colors.navy, mt: 1 }}>ขอขอบคุณครับ/ค่ะ</Typography>
          <Button
            startIcon={<HomeOutlinedIcon />}
            onClick={() => navigate('/profile')}
            sx={{ mt: 2, borderRadius: '40px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy, px: 2.5 }}
          >
            คุณได้ปฏิเสธงานนี้ กรุณากลับหน้าหลัก
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}
