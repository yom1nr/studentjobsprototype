package controllers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
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

	// The application is the anchor: it proves the student applied to a post of
	// yours and that you accepted them, so the flow apply → accept → interview
	// can't be skipped, and it says which position the appointment is for.
	var application models.Application
	err := h.db.Where("application_id = ? AND jobpost_id IN (?)", payload.ApplicationID,
		h.db.Model(&models.Jobpost{}).Select("jobpost_id").Where("user_id = ?", employer.UserID)).
		First(&application).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "application not found", "no application of yours exists with the given id")
		} else {
			utils.JSONInternalError(c, "create failed", err)
		}
		return
	}
	if application.Status != "accepted" {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "accept this application before scheduling an interview for it")
		return
	}

	var student models.Student
	if err := h.db.First(&student, application.StudentID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "student not found", "no student exists for this application")
		return
	}

	// Declining an offer closes that position for this student, not every position
	// they applied for — so nothing extra is checked here. The one-interview-per-
	// application rule below already stops the declined application itself from
	// being scheduled again.

	// One live appointment per application — the UI shows a single appointment
	// per application row, so a second would silently become unreachable.
	var existing models.InterviewSchedule
	err = h.db.Where("application_id = ? AND status <> ?", application.ApplicationID, "cancelled").
		First(&existing).Error
	if err == nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "this application already has an interview — edit that appointment instead")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	date, err := time.Parse("2006-01-02", payload.AppointmentDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid appointment_date", "expected format YYYY-MM-DD")
		return
	}

	applicationID := application.ApplicationID
	interview := &models.InterviewSchedule{
		ApplicationID:      &applicationID,
		StudentID:          student.UserID,
		EmployerID:         employer.UserID,
		InterviewFormat:    payload.InterviewFormat,
		AppointmentTime:    payload.AppointmentTime,
		AppointmentDate:    &date,
		Location:           payload.Location,
		PreparationDetails: payload.PreparationDetails,
	}
	if err := h.db.Create(interview).Error; err != nil {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	notifyUser(h.db, student.UserID, "นัดหมายสัมภาษณ์ใหม่", "interview_scheduled",
		fmt.Sprintf("%s นัดสัมภาษณ์คุณวันที่ %s เวลา %s น.", employer.CompanyName, payload.AppointmentDate, payload.AppointmentTime))

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(interview, employer.CompanyName, h.studentName(student.UserID)))
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
		if err := h.db.Preload("Reschedules").Where("employer_id = ?", employer.UserID).Order("created_at DESC").Find(&interviews).Error; err != nil {
			utils.JSONInternalError(c, "failed to load interviews", err)
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
	if err := h.db.Preload("Reschedules").Where("student_id = ?", student.UserID).Order("created_at DESC").Find(&interviews).Error; err != nil {
		utils.JSONInternalError(c, "failed to load interviews", err)
		return
	}
	responses := make([]dto.InterviewResponse, 0, len(interviews))
	for i := range interviews {
		responses = append(responses, h.mapToResponse(&interviews[i], h.companyName(interviews[i].EmployerID), h.studentName(student.UserID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// UpdateInterview lets the employer edit an interview's appointment details.
func (h *InterviewController) UpdateInterview(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}
	// A finished appointment is a record of what happened, not a plan — moving it
	// after the result is out would rewrite history and contradict what the
	// student was already told.
	if interview.Status == "completed" || interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "this interview is already finished")
		return
	}
	if interview.Status == "cancelled" {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "this interview has been cancelled")
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
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(interview, employer.CompanyName, h.studentName(interview.StudentID)))
}

// utcInstant parses an RFC3339 timestamp and requires a UTC offset ("Z" or
// "+00:00"). Reschedule times are stored and shown as their literal wall-clock
// digits with no zone conversion, so a value carrying a real offset —
// 13:30+07:00 — would be saved as 06:30 and read back as the wrong time by
// everyone. Rejecting it here keeps that convention enforced, not assumed.
func utcInstant(raw string) (time.Time, bool) {
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, false
	}
	if _, offset := t.Zone(); offset != 0 {
		return time.Time{}, false
	}
	return t.UTC(), true
}

// RequestReschedule lets either party (employer or student, based on the caller's
// role) propose a change to an existing interview. Every call is recorded as a
// new RescheduleInterview history entry and notifies the other party.
func (h *InterviewController) RequestReschedule(c *gin.Context) {
	interview, ok := h.partyToInterview(c)
	if !ok {
		return
	}
	// Nothing left to move once the interview has been held and its result sent.
	if interview.Status == "completed" || interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "this interview is already finished")
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

	// Only one request may be open at a time, otherwise approving an older one
	// would silently overwrite a newer agreed time.
	var open models.RescheduleInterview
	err := h.db.Where("interview_schedule_id = ? AND status = ?", interview.InterviewID, "pending").First(&open).Error
	if err == nil {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "there is already a reschedule request waiting for an answer")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "request failed", err)
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	requestedBy := "student"
	if role == "employer" {
		requestedBy = "employer"
	}

	reschedule := &models.RescheduleInterview{
		InterviewScheduleID: interview.InterviewID,
		RescheduleReason:    payload.Reason,
		RequestedBy:         requestedBy,
		Status:              "pending",
	}

	if requestedBy == "employer" {
		// The employer offers times; the student picks one. Store them normalised
		// so the student's later pick can be matched exactly against the list.
		if len(payload.ProposedSlots) == 0 {
			utils.JSONError(c, http.StatusBadRequest, "request failed", "offer at least one date for the student to choose from")
			return
		}
		slots := make([]string, 0, len(payload.ProposedSlots))
		for _, raw := range payload.ProposedSlots {
			t, valid := utcInstant(raw)
			if !valid {
				utils.JSONError(c, http.StatusBadRequest, "request failed", "each proposed slot must be RFC3339 in UTC, e.g. 2026-09-20T13:30:00Z")
				return
			}
			slots = append(slots, t.Format(time.RFC3339))
		}
		reschedule.ProposedSlots = strings.Join(slots, ",")
	} else {
		// The student names the single time they want; the employer decides.
		t, valid := utcInstant(payload.StudentAvailableDateTime)
		if !valid {
			utils.JSONError(c, http.StatusBadRequest, "request failed", "student_available_date_time must be RFC3339 in UTC, e.g. 2026-09-20T13:30:00Z")
			return
		}
		reschedule.StudentAvailableDateTime = &t
	}

	if err := h.db.Create(reschedule).Error; err != nil {
		utils.JSONInternalError(c, "request failed", err)
		return
	}
	h.db.Model(interview).Update("status", "rescheduling")

	var student models.Student
	h.db.First(&student, interview.StudentID)
	var employer models.Employer
	h.db.First(&employer, interview.EmployerID)

	if requestedBy == "employer" {
		notifyAboutReschedule(h.db, student.UserID, "ผู้ประกอบการขอเลื่อนนัดสัมภาษณ์", "interview_reschedule_offer",
			fmt.Sprintf("%s เสนอวันสัมภาษณ์ใหม่ %d วันให้เลือก — กรุณาเลือกวันที่สะดวก%s",
				employer.CompanyName, len(payload.ProposedSlots), reasonSuffix(payload.Reason)),
			interview.InterviewID, reschedule.RescheduleID)
	} else {
		notifyAboutReschedule(h.db, employer.UserID, "นักศึกษาขอเลื่อนนัดสัมภาษณ์", "interview_reschedule_request",
			fmt.Sprintf("%s ขอเลื่อนนัดเป็นวันที่ %s — กรุณาอนุมัติหรือปฏิเสธ%s",
				h.studentName(student.UserID), reschedule.StudentAvailableDateTime.Format("2006-01-02 15:04"), reasonSuffix(payload.Reason)),
			interview.InterviewID, reschedule.RescheduleID)
	}

	utils.JSONSuccess(c, http.StatusCreated, mapRescheduleToResponse(reschedule))
}

// reasonSuffix appends the requester's note to a notification when they wrote one.
func reasonSuffix(reason string) string {
	if strings.TrimSpace(reason) == "" {
		return ""
	}
	return " (เหตุผล: " + reason + ")"
}

// applySlotToInterview moves the appointment to t and puts the interview back to
// a confirmed state, so an agreed reschedule leaves nothing stuck in
// "rescheduling". AppointmentDate and AppointmentTime are stored separately, so
// the slot is split across both.
func (h *InterviewController) applySlotToInterview(tx *gorm.DB, interviewID uint, t time.Time) error {
	// Slots arrive as UTC and are stored that way, but the driver hands them back
	// in the server's local zone. Normalising here keeps the wall clock the user
	// picked — without it a 14:00 request lands on the appointment as 21:00.
	utc := t.UTC()
	day := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	return tx.Model(&models.InterviewSchedule{}).Where("interview_id = ?", interviewID).
		Updates(map[string]any{
			"appointment_date": day,
			"appointment_time": utc.Format("15:04"),
			"status":           "confirmed",
		}).Error
}

// RespondToReschedule is the employer approving or rejecting the time a student
// asked to move to. Approving moves the appointment; rejecting leaves the
// original time standing. Either way the interview stops being "rescheduling".
func (h *InterviewController) RespondToReschedule(c *gin.Context, approve bool) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid reschedule id", "id must be a number")
		return
	}

	var reschedule models.RescheduleInterview
	if err := h.db.First(&reschedule, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, reschedule.InterviewScheduleID).Error; err != nil || interview.EmployerID != employer.UserID {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	if reschedule.RequestedBy != "student" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request is for the student to answer, not you")
		return
	}
	if reschedule.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this reschedule request has already been answered")
		return
	}

	var payload dto.RejectRescheduleRequest
	_ = c.ShouldBindJSON(&payload)

	now := time.Now().UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{"responded_at": &now}
		if approve {
			updates["status"] = "accepted"
			updates["new_appointment_date_time"] = reschedule.StudentAvailableDateTime
		} else {
			updates["status"] = "rejected"
		}
		if err := tx.Model(&models.RescheduleInterview{}).Where("reschedule_id = ?", reschedule.RescheduleID).
			Updates(updates).Error; err != nil {
			return err
		}
		if approve && reschedule.StudentAvailableDateTime != nil {
			return h.applySlotToInterview(tx, interview.InterviewID, *reschedule.StudentAvailableDateTime)
		}
		// Turned down: the original appointment stands, so hand the interview back
		// to its pre-request state rather than leaving it in "rescheduling".
		return tx.Model(&models.InterviewSchedule{}).Where("interview_id = ?", interview.InterviewID).
			Update("status", "confirmed").Error
	}); err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	var student models.Student
	h.db.First(&student, interview.StudentID)
	if approve {
		notifyAboutReschedule(h.db, student.UserID, "อนุมัติการเลื่อนนัดสัมภาษณ์", "interview_reschedule_result",
			fmt.Sprintf("%s อนุมัติการเลื่อนนัดแล้ว นัดใหม่คือวันที่ %s — รอผลการสัมภาษณ์ต่อไป",
				employer.CompanyName, reschedule.StudentAvailableDateTime.UTC().Format("2006-01-02 15:04")),
			interview.InterviewID, reschedule.RescheduleID)
	} else {
		notifyAboutReschedule(h.db, student.UserID, "ไม่อนุมัติการเลื่อนนัดสัมภาษณ์", "interview_reschedule_result",
			fmt.Sprintf("%s ไม่อนุมัติการเลื่อนนัด กำหนดการเดิมยังมีผลอยู่%s", employer.CompanyName, reasonSuffix(payload.Reason)),
			interview.InterviewID, reschedule.RescheduleID)
	}

	h.db.First(&reschedule, reschedule.RescheduleID)
	utils.JSONSuccess(c, http.StatusOK, mapRescheduleToResponse(&reschedule))
}

// ApproveReschedule accepts the student's proposed time.
func (h *InterviewController) ApproveReschedule(c *gin.Context) { h.RespondToReschedule(c, true) }

// RejectReschedule declines the student's proposed time.
func (h *InterviewController) RejectReschedule(c *gin.Context) { h.RespondToReschedule(c, false) }

// SelectRescheduleSlot is the student choosing one of the times the employer
// offered. There is no further approval step — the employer already committed to
// every slot they listed, so picking one settles the appointment immediately.
func (h *InterviewController) SelectRescheduleSlot(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid reschedule id", "id must be a number")
		return
	}

	var reschedule models.RescheduleInterview
	if err := h.db.First(&reschedule, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, reschedule.InterviewScheduleID).Error; err != nil || interview.StudentID != userID {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	if reschedule.RequestedBy != "employer" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request is for the employer to answer, not you")
		return
	}
	if reschedule.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this reschedule request has already been answered")
		return
	}

	var payload dto.SelectRescheduleSlotRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}
	chosen, valid := utcInstant(payload.SelectedDateTime)
	if !valid {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "selected_date_time must be RFC3339 in UTC")
		return
	}
	// Only a time the employer actually offered may be chosen.
	normalised := chosen.Format(time.RFC3339)
	offered := false
	for _, s := range strings.Split(reschedule.ProposedSlots, ",") {
		if s == normalised {
			offered = true
			break
		}
	}
	if !offered {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "pick one of the dates the employer offered")
		return
	}

	now := time.Now().UTC()
	utc := chosen.UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.RescheduleInterview{}).Where("reschedule_id = ?", reschedule.RescheduleID).
			Updates(map[string]any{
				"status":                    "accepted",
				"new_appointment_date_time": &utc,
				"responded_at":              &now,
			}).Error; err != nil {
			return err
		}
		return h.applySlotToInterview(tx, interview.InterviewID, utc)
	}); err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	var employer models.Employer
	h.db.First(&employer, interview.EmployerID)
	notifyAboutReschedule(h.db, employer.UserID, "นักศึกษาเลือกวันสัมภาษณ์แล้ว", "interview_reschedule_result",
		fmt.Sprintf("%s เลือกวันสัมภาษณ์เป็นวันที่ %s", h.studentName(interview.StudentID), utc.Format("2006-01-02 15:04")),
		interview.InterviewID, reschedule.RescheduleID)

	h.db.First(&reschedule, reschedule.RescheduleID)
	utils.JSONSuccess(c, http.StatusOK, mapRescheduleToResponse(&reschedule))
}

// ListReschedules returns the reschedule history for one interview.
func (h *InterviewController) ListReschedules(c *gin.Context) {
	interview, ok := h.partyToInterview(c)
	if !ok {
		return
	}
	var reschedules []models.RescheduleInterview
	if err := h.db.Where("interview_schedule_id = ?", interview.InterviewID).Order("created_at DESC").Find(&reschedules).Error; err != nil {
		utils.JSONInternalError(c, "failed to load reschedule history", err)
		return
	}
	responses := make([]dto.RescheduleResponse, 0, len(reschedules))
	for _, r := range reschedules {
		responses = append(responses, mapRescheduleToResponse(&r))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// SendResult notifies the student of their interview outcome and persists it on
// the InterviewSchedule (Result / ResultComment / ResultAnnouncedAt, status
// "completed"). The stored "passed" is what gates drafting an employment
// agreement, so it has to outlive the notification.
func (h *InterviewController) SendResult(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.UserID)
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

	// The result drives what the student is told and whether an employment
	// agreement may be drafted, so it is announced once and not overwritten.
	if interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "the result for this interview has already been announced")
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
		utils.JSONInternalError(c, "action failed", err)
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
	notifyAboutInterview(h.db, student.UserID, "ผลการพิจารณาสัมภาษณ์", "interview_result", message, interview.InterviewID)

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
	if err := h.db.Where("interview_id = ? AND student_id = ?", id, student.UserID).First(&interview).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return
	}
	// Confirming attendance is only meaningful while the appointment is still
	// ahead. Allowing it afterwards rewinds status from "completed" back to
	// "confirmed", which leaves an announced result sitting on a schedule that
	// claims the interview has not happened yet.
	if interview.Status == "completed" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this interview is already finished")
		return
	}
	if interview.Status == "cancelled" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this interview has been cancelled")
		return
	}

	confirmedAt := time.Now()
	if err := h.db.Model(&interview).Updates(map[string]any{
		"status":       "confirmed",
		"confirmed_at": &confirmedAt,
	}).Error; err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	appointmentDate := ""
	if interview.AppointmentDate != nil {
		appointmentDate = interview.AppointmentDate.Format("2006-01-02")
	}
	var employer models.Employer
	if err := h.db.First(&employer, interview.EmployerID).Error; err == nil {
		notifyAboutInterview(h.db, employer.UserID, "นักศึกษายืนยันเข้ารับสัมภาษณ์", "interview_confirmed",
			fmt.Sprintf("%s ยืนยันนัดสัมภาษณ์วันที่ %s เวลา %s น. แล้ว", h.studentName(student.UserID), appointmentDate, interview.AppointmentTime),
			interview.InterviewID)
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
			utils.JSONInternalError(c, "action failed", err)
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

// partyToInterview loads the interview named by :id but only for the two people
// actually on it — the student it was booked for, or the employer who booked it.
// Reschedule requests and their history are shared by both sides, so neither an
// employer-only nor a student-only guard fits; without this any signed-in user
// could reschedule or read someone else's appointment by guessing its id.
func (h *InterviewController) partyToInterview(c *gin.Context) (*models.InterviewSchedule, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}
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
	// Student and employer ids both reference users.user_id, so the caller's own
	// id is enough to tell whether they are on this appointment.
	if interview.StudentID != userID && interview.EmployerID != userID {
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
		ID:                 iv.InterviewID,
		ApplicationID:      iv.ApplicationID,
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
	respondedAt := ""
	if r.RespondedAt != nil {
		respondedAt = r.RespondedAt.Format(time.RFC3339)
	}
	slots := []string{}
	if r.ProposedSlots != "" {
		slots = strings.Split(r.ProposedSlots, ",")
	}
	return dto.RescheduleResponse{
		ID:                       r.RescheduleID,
		RequestedBy:              r.RequestedBy,
		Status:                   r.Status,
		StudentAvailableDateTime: studentAvailable,
		ProposedSlots:            slots,
		NewAppointmentDateTime:   newAppointment,
		RescheduleReason:         r.RescheduleReason,
		RespondedAt:              respondedAt,
		CreatedAt:                r.CreatedAt.Format(time.RFC3339),
	}
}

// notifyAboutInterview is notifyUser plus a link back to the interview that
// triggered it, so the notification list can deep-link into the appointment.
// notifyAboutReschedule links the notification to both the interview and the
// reschedule request behind it, so the student's notification can open straight
// into the slot picker for that specific request.
func notifyAboutReschedule(db *gorm.DB, userID uint, title, notificationType, message string, interviewID, rescheduleID uint) {
	n := &models.Notification{
		UserID:                userID,
		InterviewScheduleID:   &interviewID,
		RescheduleInterviewID: &rescheduleID,
		Title:                 title,
		NotificationType:      notificationType,
		Message:               message,
	}
	if err := db.Create(n).Error; err != nil {
		log.Printf("failed to create notification for user %d: %v", userID, err)
	}
}

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
