package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/dto"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// ComplaintController manages complaint submission, tracking, and admin resolution (B6716493 subsystem 1).
type ComplaintController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewComplaintController creates a new ComplaintController.
func NewComplaintController(db *gorm.DB) *ComplaintController {
	return &ComplaintController{db: db, validate: validator.New()}
}

// Create submits a new complaint on behalf of the current user (student or employer).
func (h *ComplaintController) Create(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	var payload dto.CreateComplaintRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	complaint := &models.Complaint{
		UserID:        userID,
		Title:         payload.Title,
		Description:   payload.Description,
		ReferenceType: payload.ReferenceType,
	}
	if err := h.db.Create(complaint).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	history := &models.ComplaintHistory{
		ComplaintID:  complaint.ID,
		Status:       "submitted",
		ActionByRole: role,
		Note:         "ได้รับเรื่องร้องเรียนเรียบร้อย",
		Timestamp:    time.Now().UTC(),
	}
	h.db.Create(history)
	complaint.Histories = []models.ComplaintHistory{*history}

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(complaint))
}

// ListMine returns the current user's own complaints.
func (h *ComplaintController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	var complaints []models.Complaint
	if err := h.db.Preload("Histories").Preload("Attachments").Where("user_id = ?", userID).Order("created_at DESC").Find(&complaints).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load complaints", err.Error())
		return
	}

	responses := make([]dto.ComplaintResponse, 0, len(complaints))
	for i := range complaints {
		responses = append(responses, h.mapToResponse(&complaints[i]))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ListAll returns every complaint (admin only).
func (h *ComplaintController) ListAll(c *gin.Context) {
	var complaints []models.Complaint
	if err := h.db.Preload("Histories").Preload("Attachments").Order("created_at DESC").Find(&complaints).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load complaints", err.Error())
		return
	}

	responses := make([]dto.ComplaintResponse, 0, len(complaints))
	for i := range complaints {
		responses = append(responses, h.mapToResponse(&complaints[i]))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetDetail returns one complaint, restricted to its own submitter or an admin.
func (h *ComplaintController) GetDetail(c *gin.Context) {
	complaint, ok := h.loadComplaint(c)
	if !ok {
		return
	}

	userID, _ := utils.GetUserIDFromContext(c)
	role, _ := utils.GetUserRoleFromContext(c)
	if complaint.UserID != userID && role != "admin" {
		utils.JSONError(c, http.StatusNotFound, "complaint not found", "no complaint exists with the given id")
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(complaint))
}

// AddAttachment records an uploaded file's metadata against a complaint (no real
// file storage exists anywhere in this app - same convention as other uploads).
func (h *ComplaintController) AddAttachment(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid complaint id", "id must be a number")
		return
	}
	var complaint models.Complaint
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&complaint).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "complaint not found", "no complaint exists with the given id")
		return
	}

	var payload dto.AddComplaintAttachmentRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	attachment := &models.Attachment{
		ComplaintID: complaint.ID,
		FileName:    payload.FileName,
		FileType:    payload.FileType,
		FileSize:    payload.FileSize,
	}
	if err := h.db.Create(attachment).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "upload failed", err.Error())
		return
	}

	h.db.Preload("Histories").Preload("Attachments").First(&complaint, complaint.ID)
	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(&complaint))
}

// AddHistory lets an admin move a complaint's status forward.
func (h *ComplaintController) AddHistory(c *gin.Context) {
	complaint, ok := h.loadComplaint(c)
	if !ok {
		return
	}

	var payload dto.AddComplaintHistoryRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	history := &models.ComplaintHistory{
		ComplaintID:  complaint.ID,
		Status:       payload.Status,
		ActionByRole: "admin",
		Note:         payload.Note,
		Timestamp:    time.Now().UTC(),
	}
	if err := h.db.Create(history).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
		return
	}

	if payload.Status == "resolved" {
		complaint.ResolutionDetail = payload.Note
	}
	h.db.Model(&models.Complaint{}).Where("id = ?", complaint.ID).Update("resolution_detail", complaint.ResolutionDetail)

	var submitter models.User
	if h.db.First(&submitter, complaint.UserID).Error == nil {
		notifyUser(h.db, submitter.ID, "อัปเดตสถานะข้อร้องเรียน", "complaint_status",
			"เรื่องร้องเรียน \""+complaint.Title+"\" อัปเดตสถานะแล้ว")
	}

	h.db.Preload("Histories").Preload("Attachments").First(complaint, complaint.ID)
	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(complaint))
}

func (h *ComplaintController) loadComplaint(c *gin.Context) (*models.Complaint, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid complaint id", "id must be a number")
		return nil, false
	}
	var complaint models.Complaint
	if err := h.db.Preload("Histories").Preload("Attachments").First(&complaint, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "complaint not found", "no complaint exists with the given id")
		return nil, false
	}
	return &complaint, true
}

func (h *ComplaintController) mapToResponse(complaint *models.Complaint) dto.ComplaintResponse {
	var user models.User
	h.db.First(&user, complaint.UserID)

	submitterName := user.UserName
	submitterRole := user.Role
	if submitterRole == "student" {
		var student models.Student
		if h.db.Where("user_id = ?", complaint.UserID).First(&student).Error == nil {
			submitterName = student.FirstName + " " + student.LastName
		}
	} else if submitterRole == "employer" {
		var employer models.Employer
		if h.db.Where("user_id = ?", complaint.UserID).First(&employer).Error == nil {
			submitterName = employer.CompanyName
		}
	}

	histories := make([]dto.ComplaintHistoryResponse, 0, len(complaint.Histories))
	for _, hst := range complaint.Histories {
		histories = append(histories, dto.ComplaintHistoryResponse{
			ID:           hst.ID,
			Status:       hst.Status,
			ActionByRole: hst.ActionByRole,
			Note:         hst.Note,
			Timestamp:    hst.Timestamp.Format(time.RFC3339),
		})
	}
	attachments := make([]dto.ComplaintAttachmentResponse, 0, len(complaint.Attachments))
	for _, a := range complaint.Attachments {
		attachments = append(attachments, dto.ComplaintAttachmentResponse{FileName: a.FileName, FileSize: a.FileSize})
	}

	latestStatus := "submitted"
	if len(complaint.Histories) > 0 {
		latestStatus = complaint.Histories[len(complaint.Histories)-1].Status
	}

	return dto.ComplaintResponse{
		ID:               complaint.ID,
		Title:            complaint.Title,
		Description:      complaint.Description,
		ReferenceType:    complaint.ReferenceType,
		Status:           latestStatus,
		ResolutionDetail: complaint.ResolutionDetail,
		CreatedAt:        complaint.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        complaint.UpdatedAt.Format(time.RFC3339),
		SubmitterName:    submitterName,
		SubmitterRole:    submitterRole,
		Histories:        histories,
		Attachments:      attachments,
	}
}
