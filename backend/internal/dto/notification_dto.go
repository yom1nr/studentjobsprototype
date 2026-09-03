package dto

type NotificationResponse struct {
    ID               uint   `json:"id"`
    Title            string `json:"title"`
    NotificationType string `json:"notification_type"`
    Message          string `json:"message"`
    IsRead           bool   `json:"is_read"`
    CreatedAt        string `json:"created_at"`
    // Source references, so a notification can open the exact thing it is about —
    // notably the reschedule request whose slots the student needs to choose from.
    // Null when the notification has no such source.
    InterviewScheduleID   *uint `json:"interview_schedule_id"`
    RescheduleInterviewID *uint `json:"reschedule_interview_id"`
}
