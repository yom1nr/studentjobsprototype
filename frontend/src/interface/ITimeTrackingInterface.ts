export type TimeEditRequestStatus = 'pending' | 'approved' | 'rejected'

export type TimeEditRequestRecord = {
  id: number
  time_record_id: number
  student_name: string
  old_check_in_time: string
  old_check_out_time: string
  new_check_in_time: string
  new_check_out_time: string
  reason: string
  request_status: TimeEditRequestStatus
  created_at: string
}

export type TimeRecordEntry = {
  id: number
  student_id: number
  student_name: string
  check_in_time: string
  check_out_time: string
  hours: number
  latitude: number
  longitude: number
  record_status: string
  edit_request?: TimeEditRequestRecord
}

export type CheckInRequest = {
  latitude: number
  longitude: number
}

export type CreateTimeEditRequestPayload = {
  new_check_in_time: string
  new_check_out_time: string
  reason: string
}

export type RejectTimeEditRequestPayload = {
  reason?: string
}
