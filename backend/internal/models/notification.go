package models

import "gorm.io/gorm"

// Notification is an in-app message sent to a user (e.g. employer-approval
// decisions, interview/agreement updates). CreatedAt from gorm.Model doubles
// as the diagram's CreatedDateTime attribute.
type Notification struct {
    gorm.Model
    UserID           uint   `gorm:"not null;index" json:"user_id"`
    Title            string `gorm:"size:200;not null" json:"title"`
    NotificationType string `gorm:"size:50;not null" json:"notification_type"`
    Message          string `gorm:"type:text;not null" json:"message"`
    IsRead           bool   `gorm:"not null;default:false" json:"is_read"`
}
