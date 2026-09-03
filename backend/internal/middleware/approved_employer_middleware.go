package middleware

import (
    "errors"
    "net/http"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/models"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// RequireApprovedEmployer blocks an employer action route unless the current
// employer's registration has been approved by an admin. Read-only routes and
// the employer's own profile (where they resubmit documents) are left open so a
// pending/rejected employer can still see their status and respond. Must run
// after JWTAuthMiddleware + RequireRole("employer").
func RequireApprovedEmployer(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, ok := utils.GetUserIDFromContext(c)
        if !ok {
            utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
            c.Abort()
            return
        }

        var approve models.Approve
        err := db.Where("user_id = ?", userID).First(&approve).Error
        if errors.Is(err, gorm.ErrRecordNotFound) {
            utils.JSONError(c, http.StatusForbidden, "บัญชียังไม่ได้ส่งข้อมูลเพื่อขออนุมัติ", "")
            c.Abort()
            return
        }
        if err != nil {
            utils.JSONInternalError(c, "could not verify approval status", err)
            c.Abort()
            return
        }

        if approve.Status != "approved" {
            msg := "บัญชีผู้ประกอบการยังไม่ได้รับการอนุมัติ กรุณารอเจ้าหน้าที่ตรวจสอบ"
            switch approve.Status {
            case "rejected":
                msg = "บัญชีผู้ประกอบการไม่ได้รับการอนุมัติ ไม่สามารถใช้งานส่วนนี้ได้"
            case "request_document":
                msg = "เจ้าหน้าที่ขอเอกสารเพิ่มเติม กรุณาส่งเอกสารผ่านหน้าตั้งค่าก่อน"
            }
            utils.JSONError(c, http.StatusForbidden, msg, "")
            c.Abort()
            return
        }

        c.Next()
    }
}
