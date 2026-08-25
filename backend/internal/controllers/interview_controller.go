package controllers

import (
	"errors"
	"fmt"
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

// InterviewController manages interview scheduling between employers and students (B6733827 subsystem 1).
type InterviewController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewInterviewController creates a new InterviewController.
func NewInterviewController(db *gorm.DB) *InterviewController {
	return &InterviewController{db: db, validate: validator.New()}
}

// CreateInterview schedules a new interview appointment for a student.
func (h *InterviewController) CreateInterview(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	var payload dto.CreateInterviewRequest
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

	date, err := time.Parse("2006-01-02", payload.AppointmentDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid appointment_date", "expected format YYYY-MM-DD")
		return
	}

	interview := &models.InterviewSchedule{
		StudentID:          student.ID,
		EmployerID:         employer.ID,
		InterviewFormat:    payload.InterviewFormat,
		AppointmentTime:    payload.AppointmentTime,
		AppointmentDate:    &date,
		Location:           payload.Location,
		PreparationDetails: payload.PreparationDetails,
	}
	if err := h.db.Create(interview).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}

	notifyUser(h.db, student.UserID, "นัดหมายสัมภาษณ์ใหม่", "interview_scheduled",
		fmt.Sprintf("%s นัดสัมภาษณ์คุณวันที่ %s เวลา %s น.", employer.CompanyName, payload.AppointmentDate, payload.AppointmentTime))

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(interview, employer.CompanyName, h.studentName(student.ID)))
}

// ListMine returns interviews scoped to the current user's role (employer sees ones
// they created, student sees ones scheduled for them).
func (h *InterviewController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	var interviews []models.InterviewSchedule

	if role == "employer" {
		employer, ok := h.currentEmployer(c)
		if !ok {
			return
		}
		if err := h.db.Preload("Reschedules").Where("employer_id = ?", employer.ID).Order("created_at DESC").Find(&interviews).Error; err != nil {
			utils.JSONError(c, http.StatusInternalServerError, "failed to load interviews", err.Error())
			return
		}
		responses := make([]dto.InterviewResponse, 0, len(interviews))
		for i := range interviews {
			responses = append(responses, h.mapToResponse(&interviews[i], employer.CompanyName, h.studentName(interviews[i].StudentID)))
		}
		utils.JSONSuccess(c, http.StatusOK, responses)
		return
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}
	if err := h.db.Preload("Reschedules").Where("student_id = ?", student.ID).Order("created_at DESC").Find(&interviews).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load interviews", err.Error())
		return
	}
	responses := make([]dto.InterviewResponse, 0, len(interviews))
	for i := range interviews {
		responses = append(responses, h.mapToResponse(&interviews[i], h.companyName(interviews[i].EmployerID), h.studentName(student.ID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// UpdateInterview lets the employer edit an interview's appointment details.
func (h *InterviewController) UpdateInterview(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.ID)
	if !ok {
		return
	}

	var payload dto.UpdateInterviewRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}
	date, err := time.Parse("2006-01-02", payload.AppointmentDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid appointment_date", "expected format YYYY-MM-DD")
		return
	}

	interview.InterviewFormat = payload.InterviewFormat
	interview.AppointmentTime = payload.AppointmentTime
	interview.AppointmentDate = &date
	interview.Location = payload.Location
	interview.PreparationDetails = payload.PreparationDetails
	if err := h.db.Save(interview).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(interview, employer.CompanyName, h.studentName(interview.StudentID)))
}

// RequestReschedule lets either party (employer or student, based on the caller's
// role) propose a change to an existing interview. Every call is recorded as a
// new RescheduleInterview history entry and notifies the other party.
func (h *InterviewController) RequestReschedule(c *gin.Context) {
	if _, ok := utils.GetUserIDFromContext(c); !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return
	}

	var payload dto.RequestRescheduleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	requestedBy := "student"
	if role == "employer" {
		requestedBy = "employer"
	}
	reschedule := &models.RescheduleInterview{
		InterviewScheduleID: interview.ID,
		RescheduleReason:    payload.Reason,
		RequestedBy:         requestedBy,
		Status:              "pending",
	}
	if t, err := time.Parse(time.RFC3339, payload.StudentAvailableDateTime); err == nil {
		reschedule.StudentAvailableDateTime = &t
	}
	if t, err := time.Parse(time.RFC3339, payload.NewAppointmentDateTime); err == nil {
		reschedule.NewAppointmentDateTime = &t
	}
	if err := h.db.Create(reschedule).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "request failed", err.Error())
		return
	}
	h.db.Model(&interview).Update("status", "rescheduling")

	var student models.Student
	h.db.First(&student, interview.StudentID)
	var employer models.Employer
	h.db.First(&employer, interview.EmployerID)

	if role == "employer" {
		notifyUser(h.db, student.UserID, "ผู้ประกอบการขอเปลี่ยนกำหนดการสัมภาษณ์", "interview_reschedule_request", payload.Reason)
	} else {
		notifyUser(h.db, employer.UserID, "นักศึกษาขอเลื่อนนัดสัมภาษณ์", "interview_reschedule_request", payload.Reason)
	}

	utils.JSONSuccess(c, http.StatusCreated, gin.H{"created": true})
}

// ListReschedules returns the reschedule history for one interview.
func (h *InterviewController) ListReschedules(c *gin.Context) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return
	}
	var reschedules []models.RescheduleInterview
	if err := h.db.Where("interview_schedule_id = ?", id).Order("created_at DESC").Find(&reschedules).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load reschedule history", err.Error())
		return
	}
	responses := make([]dto.RescheduleResponse, 0, len(reschedules))
	for _, r := range reschedules {
		responses = append(responses, mapRescheduleToResponse(&r))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// SendResult notifies the student of their interview outcome. There's no
// persisted result field on InterviewSchedule (see dto.InterviewResultRequest) —
// "passed" becomes durable once the employer creates an EmploymentAgreement.
func (h *InterviewController) SendResult(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.ID)
	if !ok {
		return
	}

	var payload dto.InterviewResultRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	// Persist the outcome so the student can re-open the result page later and
	// the employer can see which candidates have already been told.
	now := time.Now()
	if err := h.db.Model(interview).Updates(map[string]any{
		"result":              payload.Result,
		"result_comment":      payload.Comment,
		"result_announced_at": &now,
		"status":              "completed",
	}).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
		return
	}

	var student models.Student
	h.db.First(&student, interview.StudentID)

	message := fmt.Sprintf("ผลการสัมภาษณ์ตำแหน่งที่ %s: ", employer.CompanyName)
	if payload.Result == "passed" {
		message += "ผ่านการสัมภาษณ์ กรุณารอข้อตกลงการจ้างงาน"
	} else {
		message += "ไม่ผ่านการสัมภาษณ์"
	}
	if payload.Comment != "" {
		message += " (" + payload.Comment + ")"
	}
	notifyAboutInterview(h.db, student.UserID, "ผลการพิจารณาสัมภาษณ์", "interview_result", message, interview.ID)

	utils.JSONSuccess(c, http.StatusOK, gin.H{"sent": true, "result": payload.Result})
}

// ConfirmAttendance lets the student confirm they'll attend a scheduled interview.
// The confirmation is persisted on the schedule so the UI can show the
// "รอการยืนยัน" / "ยืนยันแล้ว" badge, and a notification goes to the employer.
func (h *InterviewController) ConfirmAttendance(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}
	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return
	}
	var interview models.InterviewSchedule
	if err := h.db.Where("id = ? AND student_id = ?", id, student.ID).First(&interview).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return
	}

	confirmedAt := time.Now()
	if err := h.db.Model(&interview).Updates(map[string]any{
		"status":       "confirmed",
		"confirmed_at": &confirmedAt,
	}).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
		return
	}

	appointmentDate := ""
	if interview.AppointmentDate != nil {
		appointmentDate = interview.AppointmentDate.Format("2006-01-02")
	}
	var employer models.Employer
	if err := h.db.First(&employer, interview.EmployerID).Error; err == nil {
		notifyAboutInterview(h.db, employer.UserID, "นักศึกษายืนยันเข้ารับสัมภาษณ์", "interview_confirmed",
			fmt.Sprintf("%s ยืนยันนัดสัมภาษณ์วันที่ %s เวลา %s น. แล้ว", h.studentName(student.ID), appointmentDate, interview.AppointmentTime),
			interview.ID)
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"confirmed": true})
}

func (h *InterviewController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
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

func (h *InterviewController) ownedByEmployer(c *gin.Context, employerID uint) (*models.InterviewSchedule, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return nil, false
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	if interview.EmployerID != employerID {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	return &interview, true
}

func (h *InterviewController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *InterviewController) companyName(employerID uint) string {
	var employer models.Employer
	if err := h.db.Select("company_name").First(&employer, employerID).Error; err != nil {
		return ""
	}
	return employer.CompanyName
}

func (h *InterviewController) mapToResponse(iv *models.InterviewSchedule, companyName, studentName string) dto.InterviewResponse {
	appointmentDate := ""
	if iv.AppointmentDate != nil {
		appointmentDate = iv.AppointmentDate.Format("2006-01-02")
	}
	reschedules := make([]dto.RescheduleResponse, 0, len(iv.Reschedules))
	for i := range iv.Reschedules {
		reschedules = append(reschedules, mapRescheduleToResponse(&iv.Reschedules[i]))
	}
	return dto.InterviewResponse{
		ID:                 iv.ID,
		StudentID:          iv.StudentID,
		StudentName:        studentName,
		EmployerID:         iv.EmployerID,
		CompanyName:        companyName,
		InterviewFormat:    iv.InterviewFormat,
		AppointmentDate:    appointmentDate,
		AppointmentTime:    iv.AppointmentTime,
		Location:           iv.Location,
		PreparationDetails: iv.PreparationDetails,
		Status:             iv.Status,
		Result:             iv.Result,
		ResultComment:      iv.ResultComment,
		CreatedAt:          iv.CreatedAt.Format(time.RFC3339),
		Reschedules:        reschedules,
	}
}

func mapRescheduleToResponse(r *models.RescheduleInterview) dto.RescheduleResponse {
	studentAvailable := ""
	if r.StudentAvailableDateTime != nil {
		studentAvailable = r.StudentAvailableDateTime.Format(time.RFC3339)
	}
	newAppointment := ""
	if r.NewAppointmentDateTime != nil {
		newAppointment = r.NewAppointmentDateTime.Format(time.RFC3339)
	}
	return dto.RescheduleResponse{
		ID:                       r.ID,
		StudentAvailableDateTime: studentAvailable,
		NewAppointmentDateTime:   newAppointment,
		RescheduleReason:         r.RescheduleReason,
		CreatedAt:                r.CreatedAt.Format(time.RFC3339),
	}
}

// notifyAboutInterview is notifyUser plus a link back to the interview that
// triggered it, so the notification list can deep-link into the appointment.
func notifyAboutInterview(db *gorm.DB, userID uint, title, notificationType, message string, interviewID uint) {
	n := &models.Notification{
		UserID:              userID,
		InterviewScheduleID: &interviewID,
		Title:               title,
		NotificationType:    notificationType,
		Message:             message,
	}
	if err := db.Create(n).Error; err != nil {
		log.Printf("failed to create notification for user %d: %v", userID, err)
	}
}
