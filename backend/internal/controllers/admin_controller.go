package controllers

import (
    "errors"
    "log"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/go-playground/validator/v10"
    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/dto"
    "github.com/SA/Golang-Backend-Example/internal/models"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// AdminController manages the employer-verification workflow.
type AdminController struct {
    db       *gorm.DB
    validate *validator.Validate
}

// NewAdminController creates a new AdminController.
func NewAdminController(db *gorm.DB) *AdminController {
    return &AdminController{db: db, validate: validator.New()}
}

// ListEmployerApprovals returns employers filtered by approval status
// (?status=pending|approved|rejected, defaults to pending).
func (h *AdminController) ListEmployerApprovals(c *gin.Context) {
    status := c.DefaultQuery("status", "pending")

    var users []models.User
    if err := h.db.
        Preload("Employer.Approve").
        Where("role = ?", "employer").
        Find(&users).Error; err != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to load employers", err.Error())
        return
    }

    responses := make([]dto.EmployerApprovalResponse, 0)
    for _, user := range users {
        if user.Employer == nil || user.Employer.Approve == nil {
            continue
        }
        if user.Employer.Approve.Status != status {
            continue
        }
        responses = append(responses, mapEmployerApprovalToResponse(&user, user.Employer))
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetEmployerDetail returns one employer's profile + approval record by Employer ID.
func (h *AdminController) GetEmployerDetail(c *gin.Context) {
    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load employer", err.Error())
        return
    }
    if employer == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "no employer exists with the given id")
        return
    }

    var user models.User
    if err := h.db.First(&user, employer.UserID).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load employer", err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalToResponse(&user, employer))
}

// ApproveEmployer approves an employer's pending registration and notifies them.
func (h *AdminController) ApproveEmployer(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "approval failed", err.Error())
        return
    }
    if employer == nil || employer.Approve == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "employer has no approval record")
        return
    }

    employer.Approve.Status = "approved"
    employer.Approve.AdminID = &admin.ID
    if err := h.db.Save(employer.Approve).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "approval failed", err.Error())
        return
    }

    notifyUser(h.db, employer.UserID, "บัญชีผู้ประกอบการได้รับการอนุมัติ", "employer_approval",
        "บัญชีผู้ประกอบการของคุณได้รับการอนุมัติเรียบร้อยแล้ว สามารถเริ่มประกาศรับสมัครงานได้ทันที")

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalStatus(employer))
}

// RejectEmployer rejects an employer's pending registration with a reason and notifies them.
func (h *AdminController) RejectEmployer(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    var payload dto.RejectEmployerRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "rejection failed", err.Error())
        return
    }
    if employer == nil || employer.Approve == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "employer has no approval record")
        return
    }

    employer.Approve.Status = "rejected"
    employer.Approve.AdminID = &admin.ID
    if err := h.db.Save(employer.Approve).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "rejection failed", err.Error())
        return
    }

    notifyUser(h.db, employer.UserID, "บัญชีผู้ประกอบการไม่ผ่านการอนุมัติ", "employer_rejection",
        "บัญชีผู้ประกอบการของคุณไม่ผ่านการอนุมัติ เหตุผล: "+payload.Reason)

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalStatus(employer))
}

func (h *AdminController) currentAdmin(c *gin.Context) (*models.Admin, bool) {
    adminUserID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return nil, false
    }

    var admin models.Admin
    if err := h.db.Where("user_id = ?", adminUserID).First(&admin).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            utils.JSONError(c, http.StatusBadRequest, "action failed", "admin profile not found for current user")
        } else {
            utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
        }
        return nil, false
    }

    return &admin, true
}

func (h *AdminController) findEmployerByID(id uint) (*models.Employer, error) {
    var employer models.Employer
    err := h.db.Preload("Approve").First(&employer, id).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &employer, nil
}

// notifyUser writes an in-app notification. Best-effort: a notification failure
// shouldn't roll back an approval/rejection decision that already succeeded.
func notifyUser(db *gorm.DB, userID uint, title, notificationType, message string) {
    notification := &models.Notification{
        UserID:           userID,
        Title:            title,
        NotificationType: notificationType,
        Message:          message,
    }
    if err := db.Create(notification).Error; err != nil {
        log.Printf("failed to create notification for user %d: %v", userID, err)
    }
}

func mapEmployerApprovalToResponse(user *models.User, employer *models.Employer) dto.EmployerApprovalResponse {
    status := ""
    dateOfSignUp := ""
    if employer.Approve != nil {
        status = employer.Approve.Status
        dateOfSignUp = employer.Approve.DateOfSignUp
    }

    return dto.EmployerApprovalResponse{
        EmployerID:     employer.ID,
        UserID:         user.ID,
        Email:          user.Email,
        FirstName:      employer.FirstName,
        LastName:       employer.LastName,
        CompanyName:    employer.CompanyName,
        BusinessType:   employer.BusinessType,
        TaxID:          employer.TaxID,
        CompanyAddress: employer.CompanyAddress,
        Status:         status,
        DateOfSignUp:   dateOfSignUp,
    }
}

func mapEmployerApprovalStatus(employer *models.Employer) gin.H {
    return gin.H{
        "employer_id": employer.ID,
        "status":      employer.Approve.Status,
        "reviewed_at": time.Now().UTC().Format(time.RFC3339),
    }
}
