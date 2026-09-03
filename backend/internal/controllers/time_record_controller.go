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

// TimeRecordController manages student clock-in/out and time-edit requests (B6729875 subsystem 1).
type TimeRecordController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewTimeRecordController creates a new TimeRecordController.
func NewTimeRecordController(db *gorm.DB) *TimeRecordController {
	return &TimeRecordController{db: db, validate: validator.New()}
}

// CheckIn starts a new time record for the current student.
func (h *TimeRecordController) CheckIn(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	var payload dto.CheckInRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}

	// Hours only mean something under an accepted agreement — that is what ties a
	// record to an employer (see employerForStudent) and what payroll bills
	// against. Without this check a student could log time nobody can ever see or
	// pay, since every employer-side list is scoped to their hired students.
	if _, hired := h.employerForStudent(student.UserID); !hired {
		utils.JSONError(c, http.StatusBadRequest, "check-in failed", "you need an accepted employment agreement before recording work time")
		return
	}

	var open models.TimeRecord
	err := h.db.Where("student_id = ? AND check_out_time IS NULL", student.UserID).First(&open).Error
	if err == nil {
		utils.JSONError(c, http.StatusBadRequest, "check-in failed", "you already have an open time record")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONError(c, http.StatusBadRequest, "check-in failed", err.Error())
		return
	}

	record := &models.TimeRecord{
		StudentID:    student.UserID,
		CheckInTime:  time.Now().UTC(),
		Latitude:     payload.Latitude,
		Longitude:    payload.Longitude,
		RecordStatus: "active",
	}
	if err := h.db.Create(record).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "check-in failed", err.Error())
		return
	}

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(record, h.studentName(student.UserID)))
}

// CheckOut closes the current student's open time record.
func (h *TimeRecordController) CheckOut(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid time record id", "id must be a number")
		return
	}
	var record models.TimeRecord
	if err := h.db.Where("record_id = ? AND student_id = ?", id, student.UserID).First(&record).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "time record not found", "no time record exists with the given id")
		return
	}
	if record.CheckOutTime != nil {
		utils.JSONError(c, http.StatusBadRequest, "check-out failed", "this time record is already checked out")
		return
	}

	var payload dto.CheckOutRequest
	_ = c.ShouldBindJSON(&payload)

	now := time.Now().UTC()
	record.CheckOutTime = &now
	record.RecordStatus = "completed"
	if err := h.db.Save(&record).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "check-out failed", err.Error())
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(&record, h.studentName(student.UserID)))
}

// ListMyTimeRecords returns the current student's own time records, newest first.
func (h *TimeRecordController) ListMyTimeRecords(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	p := utils.ParsePagination(c)
	var records []models.TimeRecord
	if err := h.db.Scopes(utils.Paginate(p)).Preload("EditRequest").Where("student_id = ?", student.UserID).Order("check_in_time DESC").Find(&records).Error; err != nil {
		utils.JSONInternalError(c, "failed to load time records", err)
		return
	}

	name := h.studentName(student.UserID)
	responses := make([]dto.TimeRecordResponse, 0, len(records))
	for i := range records {
		responses = append(responses, h.mapToResponse(&records[i], name))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ListEmployerTimeRecords returns time records for every student under an accepted
// EmploymentAgreement with the current employer.
func (h *TimeRecordController) ListEmployerTimeRecords(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	p := utils.ParsePagination(c)
	studentIDs := h.acceptedStudentIDs(employer.UserID)
	var records []models.TimeRecord
	query := h.db.Scopes(utils.Paginate(p)).Preload("EditRequest").Order("check_in_time DESC")
	if len(studentIDs) > 0 {
		query = query.Where("student_id IN ?", studentIDs)
	} else {
		query = query.Where("1 = 0")
	}
	if err := query.Find(&records).Error; err != nil {
		utils.JSONInternalError(c, "failed to load time records", err)
		return
	}

	responses := make([]dto.TimeRecordResponse, 0, len(records))
	for i := range records {
		responses = append(responses, h.mapToResponse(&records[i], h.studentName(records[i].StudentID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// CreateEditRequest lets a student ask their employer to correct a time record.
func (h *TimeRecordController) CreateEditRequest(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid time record id", "id must be a number")
		return
	}
	var record models.TimeRecord
	if err := h.db.Where("record_id = ? AND student_id = ?", id, student.UserID).First(&record).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "time record not found", "no time record exists with the given id")
		return
	}

	var payload dto.CreateTimeEditRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}
	newCheckIn, err := time.Parse(time.RFC3339, payload.NewCheckInTime)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid new_check_in_time", "expected RFC3339 format")
		return
	}
	var newCheckOutPtr *time.Time
	if newCheckOut, err := time.Parse(time.RFC3339, payload.NewCheckOutTime); err == nil {
		newCheckOutPtr = &newCheckOut
	}

	employerID, ok := h.employerForStudent(student.UserID)
	if !ok {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "no employer found for your accepted agreement")
		return
	}

	editRequest := &models.TimeEditRequest{
		RecordID:        record.RecordID,
		EmployerID:      employerID,
		NewCheckInTime:  newCheckIn,
		NewCheckOutTime: newCheckOutPtr,
		Reason:          payload.Reason,
		RequestStatus:   "pending",
	}
	if err := h.db.Create(editRequest).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "request failed", err.Error())
		return
	}

	var employer models.Employer
	if h.db.First(&employer, employerID).Error == nil {
		notifyUser(h.db, employer.UserID, "คำร้องขอแก้ไขเวลาทำงาน", "time_edit_request",
			fmt.Sprintf("%s ขอแก้ไขเวลาทำงานวันที่ %s", h.studentName(student.UserID), record.CheckInTime.Format("2006-01-02")))
	}

	utils.JSONSuccess(c, http.StatusCreated, mapTimeEditRequestToResponse(editRequest, h.studentName(student.UserID), &record))
}

// ListEmployerEditRequests returns time-edit requests submitted to the current employer.
func (h *TimeRecordController) ListEmployerEditRequests(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	p := utils.ParsePagination(c)
	var requests []models.TimeEditRequest
	if err := h.db.Scopes(utils.Paginate(p)).Where("employer_id = ?", employer.UserID).Order("created_at DESC").Find(&requests).Error; err != nil {
		utils.JSONInternalError(c, "failed to load edit requests", err)
		return
	}

	// Batch-load the referenced time records instead of one query per request.
	recordIDs := make([]uint, 0, len(requests))
	for i := range requests {
		recordIDs = append(recordIDs, requests[i].RecordID)
	}
	recordByID := make(map[uint]models.TimeRecord, len(recordIDs))
	if len(recordIDs) > 0 {
		var recs []models.TimeRecord
		h.db.Where("record_id IN ?", recordIDs).Find(&recs)
		for _, r := range recs {
			recordByID[r.RecordID] = r
		}
	}

	responses := make([]dto.TimeEditRequestResponse, 0, len(requests))
	for i := range requests {
		record := recordByID[requests[i].RecordID]
		responses = append(responses, mapTimeEditRequestToResponse(&requests[i], h.studentName(record.StudentID), &record))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ApproveEditRequest applies the requested times to the underlying time record.
func (h *TimeRecordController) ApproveEditRequest(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	editRequest, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}
	if editRequest.RequestStatus != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request has already been decided")
		return
	}

	var record models.TimeRecord
	if err := h.db.First(&record, editRequest.RecordID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "time record not found", "no time record exists with the given id")
		return
	}

	// Applying the new times and marking the request approved must be atomic.
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		record.CheckInTime = editRequest.NewCheckInTime
		record.CheckOutTime = editRequest.NewCheckOutTime
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		editRequest.RequestStatus = "approved"
		return tx.Save(editRequest).Error
	}); err != nil {
		utils.JSONInternalError(c, "approve failed", err)
		return
	}

	var student models.Student
	if h.db.First(&student, record.StudentID).Error == nil {
		notifyUser(h.db, student.UserID, "คำร้องขอแก้ไขเวลาได้รับการอนุมัติ", "time_edit_approved",
			fmt.Sprintf("เวลาทำงานวันที่ %s ถูกแก้ไขเรียบร้อยแล้ว", record.CheckInTime.Format("2006-01-02")))
	}

	utils.JSONSuccess(c, http.StatusOK, mapTimeEditRequestToResponse(editRequest, h.studentName(record.StudentID), &record))
}

// RejectEditRequest declines a time-edit request.
func (h *TimeRecordController) RejectEditRequest(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	editRequest, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}
	if editRequest.RequestStatus != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request has already been decided")
		return
	}

	var payload dto.RejectTimeEditRequest
	_ = c.ShouldBindJSON(&payload)

	editRequest.RequestStatus = "rejected"
	if err := h.db.Save(editRequest).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "reject failed", err.Error())
		return
	}

	var record models.TimeRecord
	h.db.First(&record, editRequest.RecordID)

	var student models.Student
	if h.db.First(&student, record.StudentID).Error == nil {
		message := "คำร้องขอแก้ไขเวลาไม่ได้รับการอนุมัติ"
		if payload.Reason != "" {
			message += ": " + payload.Reason
		}
		notifyUser(h.db, student.UserID, "คำร้องขอแก้ไขเวลาถูกปฏิเสธ", "time_edit_rejected", message)
	}

	utils.JSONSuccess(c, http.StatusOK, mapTimeEditRequestToResponse(editRequest, h.studentName(record.StudentID), &record))
}

func (h *TimeRecordController) currentStudent(c *gin.Context) (*models.Student, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}
	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return nil, false
	}
	return &student, true
}

func (h *TimeRecordController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
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

func (h *TimeRecordController) ownedByEmployer(c *gin.Context, employerID uint) (*models.TimeEditRequest, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request id", "id must be a number")
		return nil, false
	}
	var editRequest models.TimeEditRequest
	if err := h.db.Where("request_id = ? AND employer_id = ?", id, employerID).First(&editRequest).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "edit request not found", "no edit request exists with the given id")
		return nil, false
	}
	return &editRequest, true
}

// acceptedStudentIDs returns the student IDs with an accepted EmploymentAgreement under this employer.
func (h *TimeRecordController) acceptedStudentIDs(employerID uint) []uint {
	var ids []uint
	h.db.Model(&models.EmploymentAgreement{}).
		Where("employer_id = ? AND status = ?", employerID, "accepted").
		Pluck("student_id", &ids)
	return ids
}

// employerForStudent finds the employer from the student's most recent accepted agreement.
func (h *TimeRecordController) employerForStudent(studentID uint) (uint, bool) {
	var agreement models.EmploymentAgreement
	if err := h.db.Where("student_id = ? AND status = ?", studentID, "accepted").Order("created_at DESC").First(&agreement).Error; err != nil {
		return 0, false
	}
	return agreement.EmployerID, true
}

func (h *TimeRecordController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *TimeRecordController) mapToResponse(r *models.TimeRecord, studentName string) dto.TimeRecordResponse {
	checkOut := ""
	hours := 0.0
	if r.CheckOutTime != nil {
		checkOut = r.CheckOutTime.Format(time.RFC3339)
		hours = r.CheckOutTime.Sub(r.CheckInTime).Hours()
	}
	var editResp *dto.TimeEditRequestResponse
	if r.EditRequest != nil {
		mapped := mapTimeEditRequestToResponse(r.EditRequest, studentName, r)
		editResp = &mapped
	}
	return dto.TimeRecordResponse{
		ID:           r.RecordID,
		StudentID:    r.StudentID,
		StudentName:  studentName,
		CheckInTime:  r.CheckInTime.Format(time.RFC3339),
		CheckOutTime: checkOut,
		Hours:        hours,
		Latitude:     r.Latitude,
		Longitude:    r.Longitude,
		RecordStatus: r.RecordStatus,
		EditRequest:  editResp,
	}
}

func mapTimeEditRequestToResponse(er *models.TimeEditRequest, studentName string, record *models.TimeRecord) dto.TimeEditRequestResponse {
	oldCheckIn, oldCheckOut := "", ""
	if record != nil {
		oldCheckIn = record.CheckInTime.Format(time.RFC3339)
		if record.CheckOutTime != nil {
			oldCheckOut = record.CheckOutTime.Format(time.RFC3339)
		}
	}
	newCheckOut := ""
	if er.NewCheckOutTime != nil {
		newCheckOut = er.NewCheckOutTime.Format(time.RFC3339)
	}
	return dto.TimeEditRequestResponse{
		ID:              er.RequestID,
		TimeRecordID:    er.RecordID,
		StudentName:     studentName,
		OldCheckInTime:  oldCheckIn,
		OldCheckOutTime: oldCheckOut,
		NewCheckInTime:  er.NewCheckInTime.Format(time.RFC3339),
		NewCheckOutTime: newCheckOut,
		Reason:          er.Reason,
		RequestStatus:   er.RequestStatus,
		CreatedAt:       er.CreatedAt.Format(time.RFC3339),
	}
}
