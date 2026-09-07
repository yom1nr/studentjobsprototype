package controllers_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/SA/Golang-Backend-Example/internal/controllers"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/testsupport"
)

// TestNotificationController_MarkRead_UpdatesTheRightNotification is a
// regression test for a bug where MarkRead filtered on `id = ?` — but
// Notification's primary key column is notification_id, not id, so every
// call failed with "column \"id\" does not exist" (500) and no notification
// could ever be individually marked read. Found while testing a tester's
// bug report ("read it, but it still shows unread") that turned out to be
// exactly this.
func TestNotificationController_MarkRead_UpdatesTheRightNotification(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testsupport.SetupTestDB(t)

	userID := mustCreateEmployer(t, db, "notif.owner@example.com", "Notif Co")
	otherUserID := mustCreateEmployer(t, db, "notif.other@example.com", "Other Co")

	n1 := models.Notification{UserID: userID, Title: "A", NotificationType: "employer_request_doc", Message: "msg1"}
	n2 := models.Notification{UserID: userID, Title: "B", NotificationType: "employer_request_doc", Message: "msg2"}
	notOwned := models.Notification{UserID: otherUserID, Title: "C", NotificationType: "employer_request_doc", Message: "msg3"}
	for _, n := range []*models.Notification{&n1, &n2, &notOwned} {
		if err := db.Create(n).Error; err != nil {
			t.Fatalf("create notification: %v", err)
		}
	}

	handler := controllers.NewNotificationController(db)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	})
	r.PUT("/api/v1/notifications/:id/read", handler.MarkRead)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/notifications/"+strconv.FormatUint(uint64(n1.NotificationID), 10)+"/read", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("MarkRead: HTTP %d, body=%s (this is the exact bug: notification_id vs id column mismatch)", rec.Code, rec.Body.String())
	}

	var n1After, n2After, notOwnedAfter models.Notification
	if err := db.First(&n1After, n1.NotificationID).Error; err != nil {
		t.Fatalf("reload n1: %v", err)
	}
	if err := db.First(&n2After, n2.NotificationID).Error; err != nil {
		t.Fatalf("reload n2: %v", err)
	}
	if err := db.First(&notOwnedAfter, notOwned.NotificationID).Error; err != nil {
		t.Fatalf("reload notOwned: %v", err)
	}

	if !n1After.IsRead {
		t.Error("n1 (the one marked read) is still unread")
	}
	if n2After.IsRead {
		t.Error("n2 (a different notification for the same user) was marked read too — MarkRead is not scoped to the right row")
	}
	if notOwnedAfter.IsRead {
		t.Error("another user's notification got marked read — MarkRead is not scoped to the current user")
	}
}

