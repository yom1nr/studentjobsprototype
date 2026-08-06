export type ComplaintStatus = 'submitted' | 'in_review' | 'resolved'

export type ComplaintActionRole = 'student' | 'employer' | 'admin' | 'system'

export type ComplaintHistoryEntry = {
  id: number
  status: ComplaintStatus
  action_by_role: ComplaintActionRole
  note: string
  timestamp: string
}

export type ComplaintAttachment = {
  file_name: string
  file_size: number
}

export type Complaint = {
  id: number
  title: string
  description: string
  reference_type: string
  status: ComplaintStatus
  resolution_detail: string
  created_at: string
  updated_at: string
  submitter_name: string
  submitter_role: 'student' | 'employer'
  histories: ComplaintHistoryEntry[]
  attachments: ComplaintAttachment[]
}
