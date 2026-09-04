package controllers

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/dto"
    "github.com/SA/Golang-Backend-Example/internal/models"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// NotificationController manages the current user's notifications.
type NotificationController struct {
    db *gorm.DB
}

// NewNotificationController creates a new NotificationController.
func NewNotificationController(db *gorm.DB) *NotificationController {
    return &NotificationController{db: db}
}

// ListMine returns the current user's notifications, newest first.
// ?unread=true restricts the list to unread notifications.
func (h *NotificationController) ListMine(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    query := h.db.Where("user_id = ?", userID).Order("created_at DESC")
    if c.Query("unread") == "true" {
        query = query.Where("is_read = ?", false)
    }

    var notifications []models.Notification
    if err := query.Find(&notifications).Error; err != nil {
        utils.JSONInternalError(c, "failed to load notifications", err)
        return
    }

    responses := make([]dto.NotificationResponse, 0, len(notifications))
    for _, n := range notifications {
        responses = append(responses, mapNotificationToResponse(&n))
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// UnreadCount returns the current user's unread notification count (for a badge).
func (h *NotificationController) UnreadCount(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    var count int64
    if err := h.db.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&count).Error; err != nil {
        utils.JSONInternalError(c, "failed to count notifications", err)
        return
    }

    utils.JSONSuccess(c, http.StatusOK, gin.H{"unread_count": count})
}

// MarkRead marks a single notification as read (only if it belongs to the current user).
func (h *NotificationController) MarkRead(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    notificationID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid notification id", "id must be a number")
        return
    }

    result := h.db.Model(&models.Notification{}).
        Where("id = ? AND user_id = ?", notificationID, userID).
        Update("is_read", true)
    if result.Error != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to update notification", result.Error.Error())
        return
    }
    if result.RowsAffected == 0 {
        utils.JSONError(c, http.StatusNotFound, "notification not found", "no notification exists with the given id")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, gin.H{"updated": true})
}

// MarkAllRead marks every unread notification belonging to the current user as read.
func (h *NotificationController) MarkAllRead(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    if err := h.db.Model(&models.Notification{}).
        Where("user_id = ? AND is_read = ?", userID, false).
        Update("is_read", true).Error; err != nil {
        utils.JSONInternalError(c, "failed to update notifications", err)
        return
    }

    utils.JSONSuccess(c, http.StatusOK, gin.H{"updated": true})
}

func mapNotificationToResponse(n *models.Notification) dto.NotificationResponse {
    return dto.NotificationResponse{
        ID:                    n.NotificationID,
        Title:                 n.Title,
        NotificationType:      n.NotificationType,
        Message:               n.Message,
        IsRead:                n.IsRead,
        CreatedAt:             n.CreatedAt.Format(time.RFC3339),
        InterviewScheduleID:   n.InterviewScheduleID,
        RescheduleInterviewID: n.RescheduleInterviewID,
    }
}
