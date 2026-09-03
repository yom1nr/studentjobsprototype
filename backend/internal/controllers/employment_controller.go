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

// activeAgreementFor reports the contract currently binding this student to this
// employer, if any. "Currently" means a draft still awaiting the student's answer,
// or an accepted contract whose term has not run out — its start date plus its
// duration in months.
//
// A contract with no start date or no duration has no end that can be computed,
// so it counts as still running: treating it as expired would quietly let a second
// contract be signed on top of a live one.
func activeAgreementFor(db *gorm.DB, studentID, employerID uint) (*models.EmploymentAgreement, bool) {
	var agreements []models.EmploymentAgreement
	if err := db.Where("student_id = ? AND employer_id = ? AND status IN ?",
		studentID, employerID, []string{"pending", "accepted"}).Find(&agreements).Error; err != nil {
		return nil, false
	}
	now := time.Now().UTC()
	for i := range agreements {
		a := &agreements[i]
		if a.Status == "pending" || a.StartDate == nil || a.DurationMonths <= 0 {
			return a, true
		}
		if a.StartDate.AddDate(0, a.DurationMonths, 0).After(now) {
			return a, true
		}
	}
	return nil, false
}

// agreementEndText renders when a contract runs out, for messages that tell
// someone to wait for it. Empty when there is no computable end date.
func agreementEndText(a *models.EmploymentAgreement) string {
	if a == nil || a.StartDate == nil || a.DurationMonths <= 0 {
		return ""
	}
	return a.StartDate.UTC().AddDate(0, a.DurationMonths, 0).Format("2006-01-02")
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

	// The interview is the anchor: it proves the candidate got through this
	// employer's process, and it carries the position the contract is for.
	var passedInterview models.InterviewSchedule
	if err := h.db.Where("interview_id = ? AND employer_id = ?", payload.InterviewID, employer.UserID).
		First(&passedInterview).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview of yours exists with the given id")
		return
	}
	if passedInterview.Result != "passed" {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "announce a passing interview result before sending an employment agreement")
		return
	}

	var student models.Student
	if err := h.db.First(&student, passedInterview.StudentID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "student not found", "no student exists for this interview")
		return
	}

	// One offer per interview, whatever became of it. A student who turned an
	// offer down has answered for this position — re-sending it would let an
	// employer put the same declined terms back in front of them repeatedly.
	// Deleting the declined record is what frees the candidate up again.
	var prior models.EmploymentAgreement
	err := h.db.Where("interview_schedule_id = ?", passedInterview.InterviewID).First(&prior).Error
	if err == nil {
		detail := "an employment agreement has already been sent for this interview"
		if prior.Status == "rejected" {
			detail = "this student declined the agreement for this interview — delete the declined record first if you want to offer again"
		}
		utils.JSONError(c, http.StatusBadRequest, "create failed", detail)
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	// A student works under one contract per employer at a time. A second one
	// while the first is still running would leave two live sets of terms — wages,
	// hours, end date — for the same job relationship.
	if live, busy := activeAgreementFor(h.db, student.UserID, employer.UserID); busy {
		detail := "this student is already under contract with you"
		if end := agreementEndText(live); end != "" {
			detail += " until " + end
		}
		utils.JSONError(c, http.StatusBadRequest, "create failed", detail)
		return
	}

	start, err := time.Parse("2006-01-02", payload.StartDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid start_date", "expected format YYYY-MM-DD")
		return
	}

	interviewID := passedInterview.InterviewID
	agreement := &models.EmploymentAgreement{
		StudentID:           student.UserID,
		EmployerID:          employer.UserID,
		InterviewScheduleID: &interviewID,
		StartDate:           &start,
		WageRate:            payload.WageRate,
		DurationMonths:      payload.DurationMonths,
		WorkingHours:        payload.WorkingHours,
		LeavePolicy:         payload.LeavePolicy,
		AdditionalTerms:     payload.AdditionalTerms,
		Status:              "pending",
	}
	if err := h.db.Create(agreement).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}

	notifyUser(h.db, student.UserID, "ข้อตกลงการจ้างงานใหม่", "employment_agreement",
		fmt.Sprintf("%s ส่งข้อตกลงการจ้างงานให้คุณตรวจสอบ กรุณาตอบรับหรือปฏิเสธ", employer.CompanyName))

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(agreement, employer.CompanyName, h.studentName(student.UserID)))
}

// DeleteAgreement removes a declined offer from the employer's records.
//
// Only rejected drafts can go: a pending one is still awaiting the student's
// answer, and an accepted one is a contract in force that time records and
// payroll are billed against. Keeping a declined offer is the default — it
// preserves what was offered and why it was turned down — so this exists for
// clearing out drafts that should not be on file at all.
func (h *EmploymentController) DeleteAgreement(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid agreement id", "id must be a number")
		return
	}

	var agreement models.EmploymentAgreement
	if err := h.db.Where("agreement_id = ? AND employer_id = ?", id, employer.UserID).First(&agreement).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "agreement not found", "no agreement of yours exists with the given id")
		return
	}
	if agreement.Status != "rejected" {
		utils.JSONError(c, http.StatusBadRequest, "delete failed", "only an agreement the student declined can be deleted")
		return
	}

	var payrolls int64
	if err := h.db.Model(&models.Payroll{}).Where("agreement_id = ?", agreement.AgreementID).Count(&payrolls).Error; err != nil {
		utils.JSONInternalError(c, "delete failed", err)
		return
	}
	if payrolls > 0 {
		utils.JSONError(c, http.StatusBadRequest, "delete failed", "this agreement has payroll records attached")
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("employment_agreement_id = ?", agreement.AgreementID).Delete(&models.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Where("employment_agreement_id = ?", agreement.AgreementID).Delete(&models.Document{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.EmploymentAgreement{}, agreement.AgreementID).Error
	}); err != nil {
		utils.JSONInternalError(c, "delete failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"deleted": true})
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
		fmt.Sprintf("ข้อตกลง AG-%d เปลี่ยนสถานะเป็น \"มีผลบังคับ\"", agreement.AgreementID))

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
		fmt.Sprintf("ข้อตกลง AG-%d ถูกปฏิเสธ: %s", agreement.AgreementID, payload.Reason))

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
	if err := h.db.Where("agreement_id = ? AND student_id = ?", id, student.UserID).First(&agreement).Error; err != nil {
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
		ID:                  a.AgreementID,
		InterviewScheduleID: a.InterviewScheduleID,
		StudentID:           a.StudentID,
		StudentName:         studentName,
		EmployerID:          a.EmployerID,
		CompanyName:         companyName,
		StartDate:           startDate,
		WageRate:            a.WageRate,
		DurationMonths:      a.DurationMonths,
		WorkingHours:        a.WorkingHours,
		LeavePolicy:         a.LeavePolicy,
		AdditionalTerms:     a.AdditionalTerms,
		Status:              a.Status,
		RejectReason:        a.RejectReason,
		CreatedAt:           a.CreatedAt.Format(time.RFC3339),
	}
}
