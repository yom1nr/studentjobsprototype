package dto

type NotificationResponse struct {
    ID               uint   `json:"id"`
    Title            string `json:"title"`
    NotificationType string `json:"notification_type"`
    Message          string `json:"message"`
    IsRead           bool   `json:"is_read"`
    CreatedAt        string `json:"created_at"`
}
