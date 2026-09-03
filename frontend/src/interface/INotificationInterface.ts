export type NotificationItem = {
  id: number
  title: string
  notification_type: string
  message: string
  is_read: boolean
  created_at: string
  /** What the notification is about, so it can open that exact record —
   *  null when it has no such source. */
  interview_schedule_id: number | null
  reschedule_interview_id: number | null
}
