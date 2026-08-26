package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/dto"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// EmploymentController manages employment agreements between employers and students (B6733827 subsystem 2).
type EmploymentController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewEmploymentController creates a new EmploymentController.
func NewEmploymentController(db *gorm.DB) *EmploymentController {
	return &EmploymentController{db: db, validate: validator.New()}
}

// CreateAgreement drafts and sends an employment agreement to a student.
func (h *EmploymentController) CreateAgreement(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	var payload dto.CreateAgreementRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	var student models.Student
	if err := h.db.First(&student, payload.StudentID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "student not found", "no student exists with the given id")
		return
	}

	start, err := time.Parse("2006-01-02", payload.StartDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid start_date", "expected format YYYY-MM-DD")
		return
	}

	agreement := &models.EmploymentAgreement{
		StudentID:       student.UserID,
		EmployerID:      employer.UserID,
		StartDate:       &start,
		WageRate:        payload.WageRate,
		DurationMonths:  payload.DurationMonths,
		WorkingHours:    payload.WorkingHours,
		LeavePolicy:     payload.LeavePolicy,
		AdditionalTerms: payload.AdditionalTerms,
		Status:          "pending",
	}
	if err := h.db.Create(agreement).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}

	notifyUser(h.db, student.UserID, "ข้อตกลงการจ้างงานใหม่", "employment_agreement",
		fmt.Sprintf("%s ส่งข้อตกลงการจ้างงานให้คุณตรวจสอบ กรุณาตอบรับหรือปฏิเสธ", employer.CompanyName))

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(agreement, employer.CompanyName, h.studentName(student.UserID)))
}

// ListMine returns agreements scoped to the current user's role.
func (h *EmploymentController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	var agreements []models.EmploymentAgreement

	if role == "employer" {
		employer, ok := h.currentEmployer(c)
		if !ok {
			return
		}
		if err := h.db.Where("employer_id = ?", employer.UserID).Order("created_at DESC").Find(&agreements).Error; err != nil {
			utils.JSONError(c, http.StatusInternalServerError, "failed to load agreements", err.Error())
			return
		}
		responses := make([]dto.AgreementResponse, 0, len(agreements))
		for i := range agreements {
			responses = append(responses, h.mapToResponse(&agreements[i], employer.CompanyName, h.studentName(agreements[i].StudentID)))
		}
		utils.JSONSuccess(c, http.StatusOK, responses)
		return
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}
	if err := h.db.Where("student_id = ?", student.UserID).Order("created_at DESC").Find(&agreements).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load agreements", err.Error())
		return
	}
	responses := make([]dto.AgreementResponse, 0, len(agreements))
	for i := range agreements {
		responses = append(responses, h.mapToResponse(&agreements[i], h.companyName(agreements[i].EmployerID), h.studentName(student.UserID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// Accept lets the student accept a pending agreement.
func (h *EmploymentController) Accept(c *gin.Context) {
	agreement, employer, ok := h.ownedByCurrentStudent(c)
	if !ok {
		return
	}
	if agreement.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this agreement has already been decided")
		return
	}

	agreement.Status = "accepted"
	if err := h.db.Save(agreement).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
		return
	}

	notifyUser(h.db, employer.UserID, "นักศึกษาตอบรับข้อตกลงการจ้างงาน", "employment_agreement",
		fmt.Sprintf("ข้อตกลง AG-%d เปลี่ยนสถานะเป็น \"มีผลบังคับ\"", agreement.ID))

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(agreement, employer.CompanyName, h.studentName(agreement.StudentID)))
}

// Reject lets the student decline a pending agreement with a reason.
func (h *EmploymentController) Reject(c *gin.Context) {
	agreement, employer, ok := h.ownedByCurrentStudent(c)
	if !ok {
		return
	}
	if agreement.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this agreement has already been decided")
		return
	}

	var payload dto.RejectAgreementRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	agreement.Status = "rejected"
	agreement.RejectReason = payload.Reason
	if err := h.db.Save(agreement).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
		return
	}

	notifyUser(h.db, employer.UserID, "นักศึกษาปฏิเสธข้อตกลงการจ้างงาน", "employment_agreement",
		fmt.Sprintf("ข้อตกลง AG-%d ถูกปฏิเสธ: %s", agreement.ID, payload.Reason))

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(agreement, employer.CompanyName, h.studentName(agreement.StudentID)))
}

func (h *EmploymentController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}
	var employer models.Employer
	if err := h.db.Where("user_id = ?", userID).First(&employer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your company profile first")
		} else {
			utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
		}
		return nil, false
	}
	return &employer, true
}

func (h *EmploymentController) ownedByCurrentStudent(c *gin.Context) (*models.EmploymentAgreement, *models.Employer, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, nil, false
	}
	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return nil, nil, false
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid agreement id", "id must be a number")
		return nil, nil, false
	}
	var agreement models.EmploymentAgreement
	if err := h.db.Where("id = ? AND student_id = ?", id, student.UserID).First(&agreement).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "agreement not found", "no agreement exists with the given id")
		return nil, nil, false
	}

	var employer models.Employer
	h.db.First(&employer, agreement.EmployerID)

	return &agreement, &employer, true
}

func (h *EmploymentController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *EmploymentController) companyName(employerID uint) string {
	var employer models.Employer
	if err := h.db.Select("company_name").First(&employer, employerID).Error; err != nil {
		return ""
	}
	return employer.CompanyName
}

func (h *EmploymentController) mapToResponse(a *models.EmploymentAgreement, companyName, studentName string) dto.AgreementResponse {
	startDate := ""
	if a.StartDate != nil {
		startDate = a.StartDate.Format("2006-01-02")
	}
	return dto.AgreementResponse{
		ID:              a.ID,
		StudentID:       a.StudentID,
		StudentName:     studentName,
		EmployerID:      a.EmployerID,
		CompanyName:     companyName,
		StartDate:       startDate,
		WageRate:        a.WageRate,
		DurationMonths:  a.DurationMonths,
		WorkingHours:    a.WorkingHours,
		LeavePolicy:     a.LeavePolicy,
		AdditionalTerms: a.AdditionalTerms,
		Status:          a.Status,
		RejectReason:    a.RejectReason,
		CreatedAt:       a.CreatedAt.Format(time.RFC3339),
	}
}
