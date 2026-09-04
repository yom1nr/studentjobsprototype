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

// ApplicationController manages student job applications and the employer review of them.
type ApplicationController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewApplicationController creates a new ApplicationController.
func NewApplicationController(db *gorm.DB) *ApplicationController {
	return &ApplicationController{db: db, validate: validator.New()}
}

// CreateApplication submits the current student's application to a job post.
func (h *ApplicationController) CreateApplication(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	var payload dto.CreateApplicationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	var jobpost models.Jobpost
	if err := h.db.First(&jobpost, payload.JobpostID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "job post not found", "no job post exists with the given id")
		} else {
			utils.JSONInternalError(c, "create failed", err)
		}
		return
	}
	if jobpost.Status != "open" {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "this job post is no longer accepting applications")
		return
	}

	// Already working for this employer: applying again would start a second
	// hiring process for someone the employer is already contracted with. The
	// block is per employer, so other companies stay open — it ends when the
	// contract does.
	if live, busy := activeAgreementFor(h.db, student.UserID, jobpost.UserID); busy {
		detail := "คุณมีสัญญาจ้างงานกับผู้ประกอบการรายนี้อยู่แล้ว"
		if end := agreementEndText(live); end != "" {
			detail += " สมัครใหม่ได้หลังสัญญาหมดอายุวันที่ " + end
		}
		detail += " (สมัครงานของผู้ประกอบการรายอื่นได้ตามปกติ)"
		utils.JSONError(c, http.StatusBadRequest, "create failed", detail)
		return
	}

	var existing models.Application
	err := h.db.Where("student_id = ? AND jobpost_id = ?", student.UserID, payload.JobpostID).First(&existing).Error
	if err == nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "you have already applied to this job post")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	now := time.Now().UTC()
	application := &models.Application{
		StudentID: student.UserID,
		JobpostID: payload.JobpostID,
		ApplyDate: &now,
		Remarks:   payload.Remarks,
		Status:    "pending",
	}
	if err := h.db.Create(application).Error; err != nil {
		utils.JSONInternalError(c, "create failed", err)
		return
	}
	application.Jobpost = jobpost

	var employer models.Employer
	h.db.Select("company_name").First(&employer, jobpost.UserID)

	utils.JSONSuccess(c, http.StatusCreated, mapApplicationToResponse(application, employer.CompanyName, "", "", "", ""))
}

// ListMyApplications returns the current student's own applications.
func (h *ApplicationController) ListMyApplications(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	var applications []models.Application
	if err := h.db.
		Preload("Jobpost").
		Preload("Documents").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		Where("student_id = ?", student.UserID).
		Order("created_at DESC").
		Find(&applications).Error; err != nil {
		utils.JSONInternalError(c, "failed to load applications", err)
		return
	}

	responses := make([]dto.ApplicationResponse, 0, len(applications))
	for i := range applications {
		var employer models.Employer
		h.db.Select("company_name").First(&employer, applications[i].Jobpost.UserID)
		responses = append(responses, mapApplicationToResponse(&applications[i], employer.CompanyName, "", "", "", ""))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// UpdateMyApplication lets a student revise their own still-open application
// (status pending or correction_requested): edit the note, replace the attached
// documents, and resubmit. The application returns to "pending" and the employer
// is notified. This is the student side of the correction_requested loop.
func (h *ApplicationController) UpdateMyApplication(c *gin.Context) {
	student, ok := h.currentStudent(c)
	if !ok {
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid application id", "id must be a number")
		return
	}

	var payload dto.UpdateApplicationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	var application models.Application
	if err := h.db.Preload("Jobpost").First(&application, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
		} else {
			utils.JSONInternalError(c, "update failed", err)
		}
		return
	}
	if application.StudentID != student.UserID {
		utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
		return
	}
	if application.Status != "pending" && application.Status != "correction_requested" {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "ใบสมัครนี้แก้ไขไม่ได้แล้ว")
		return
	}

	now := time.Now().UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		application.Remarks = payload.Remarks
		application.Status = "pending"
		if err := tx.Save(&application).Error; err != nil {
			return err
		}
		if err := tx.Where("application_id = ?", application.ApplicationID).
			Delete(&models.ApplicationDocument{}).Error; err != nil {
			return err
		}
		for _, d := range payload.Documents {
			if err := tx.Create(&models.ApplicationDocument{
				ApplicationID: application.ApplicationID,
				Name:          d.Name,
				URL:           d.URL,
			}).Error; err != nil {
				return err
			}
		}
		return tx.Create(&models.ApplicationAudit{
			ApplicationID: application.ApplicationID,
			ResultStatus:  "resubmitted",
			Comment:       payload.Remarks,
			CheckedAt:     now,
		}).Error
	}); err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	h.db.
		Preload("Jobpost").
		Preload("Documents").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		First(&application, application.ApplicationID)

	var employer models.Employer
	h.db.Select("company_name").First(&employer, application.Jobpost.UserID)

	notifyUser(h.db, application.Jobpost.UserID, "นักศึกษาส่งข้อมูลเพิ่มเติม", "application_status",
		fmt.Sprintf("นักศึกษาส่งข้อมูล/เอกสารเพิ่มเติมสำหรับใบสมัครตำแหน่ง %s แล้ว กรุณาตรวจสอบอีกครั้ง", application.Jobpost.Position))

	utils.JSONSuccess(c, http.StatusOK, mapApplicationToResponse(&application, employer.CompanyName, "", "", "", ""))
}

// ListEmployerApplications returns applications submitted to the current employer's job posts.
func (h *ApplicationController) ListEmployerApplications(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	var jobpostIDs []uint
	h.db.Model(&models.Jobpost{}).Where("user_id = ?", employer.UserID).Pluck("jobpost_id", &jobpostIDs)

	var applications []models.Application
	query := h.db.
		Preload("Jobpost").
		Preload("Documents").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		Order("created_at DESC")
	if len(jobpostIDs) > 0 {
		query = query.Where("jobpost_id IN ?", jobpostIDs)
	} else {
		query = query.Where("1 = 0")
	}
	if err := query.Find(&applications).Error; err != nil {
		utils.JSONInternalError(c, "failed to load applications", err)
		return
	}

	responses := make([]dto.ApplicationResponse, 0, len(applications))
	for i := range applications {
		name, university, phone, email := h.studentDisplayFields(applications[i].StudentID)
		responses = append(responses, mapApplicationToResponse(&applications[i], employer.CompanyName, name, university, phone, email))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetEmployerApplicationDetail returns one application, restricted to the current employer's own job posts.
func (h *ApplicationController) GetEmployerApplicationDetail(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	application, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}

	name, university, phone, email := h.studentDisplayFields(application.StudentID)
	utils.JSONSuccess(c, http.StatusOK, mapApplicationToResponse(application, employer.CompanyName, name, university, phone, email))
}

// ReviewApplication lets the employer accept, reject, or request a correction on an application.
func (h *ApplicationController) ReviewApplication(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	application, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}

	var payload dto.ReviewApplicationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	audit := &models.ApplicationAudit{
		ApplicationID: application.ApplicationID,
		ResultStatus:  payload.ResultStatus,
		Comment:       payload.Comment,
		CheckedAt:     time.Now().UTC(),
	}

	// Writing the audit row and flipping Application.Status must be atomic —
	// otherwise a failure between them leaves an audit entry with no matching
	// status change (or vice-versa). This is the pattern for every handler
	// that touches more than one row.
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(audit).Error; err != nil {
			return err
		}
		// accepted / rejected are terminal; correction_requested re-opens the
		// application for the student to revise and resubmit (-> back to pending).
		application.Status = payload.ResultStatus
		if err := tx.Save(application).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		utils.JSONInternalError(c, "review failed", err)
		return
	}

	var student models.Student
	h.db.First(&student, application.StudentID)

	message := fmt.Sprintf("ใบสมัครตำแหน่ง %s ที่ %s ", application.Jobpost.Position, employer.CompanyName)
	switch payload.ResultStatus {
	case "accepted":
		message += "ได้รับการตอบรับแล้ว"
	case "rejected":
		message += "ไม่ผ่านการพิจารณา"
	default:
		message += "ต้องการข้อมูลเพิ่มเติม: " + payload.Comment
	}
	notifyUser(h.db, student.UserID, "อัปเดตสถานะใบสมัครงาน", "application_status", message)

	name, university, phone, email := h.studentDisplayFields(application.StudentID)
	utils.JSONSuccess(c, http.StatusOK, mapApplicationToResponse(application, employer.CompanyName, name, university, phone, email))
}

// ListAdminApplications returns employer-accepted applications for the university
// admin's final verification pass (role=admin only).
func (h *ApplicationController) ListAdminApplications(c *gin.Context) {
	var applications []models.Application
	if err := h.db.
		Preload("Jobpost").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		Where("status = ?", "accepted").
		Order("created_at DESC").
		Find(&applications).Error; err != nil {
		utils.JSONInternalError(c, "failed to load applications", err)
		return
	}

	responses := make([]dto.AdminApplicationResponse, 0, len(applications))
	for i := range applications {
		var employer models.Employer
		h.db.Select("company_name").First(&employer, applications[i].Jobpost.UserID)
		name, university, _, _ := h.studentDisplayFields(applications[i].StudentID)
		responses = append(responses, mapAdminApplicationToResponse(&applications[i], employer.CompanyName, name, university))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetAdminApplicationDetail returns one application for the university admin's
// verification pass (role=admin only).
func (h *ApplicationController) GetAdminApplicationDetail(c *gin.Context) {
	application, ok := h.loadApplicationForAdmin(c)
	if !ok {
		return
	}

	var employer models.Employer
	h.db.Select("company_name").First(&employer, application.Jobpost.UserID)
	name, university, _, _ := h.studentDisplayFields(application.StudentID)
	utils.JSONSuccess(c, http.StatusOK, mapAdminApplicationToResponse(application, employer.CompanyName, name, university))
}

// VerifyApplication records the university admin's final pass/fail decision on an
// employer-accepted application. This is a separate audit trail from the employer's
// own accept/reject (Application.Status is left untouched).
func (h *ApplicationController) VerifyApplication(c *gin.Context) {
	admin, ok := h.currentAdmin(c)
	if !ok {
		return
	}
	application, ok := h.loadApplicationForAdmin(c)
	if !ok {
		return
	}

	var payload dto.VerifyApplicationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	audit := &models.ApplicationAudit{
		ApplicationID: application.ApplicationID,
		AdminID:       &admin.UserID,
		ResultStatus:  payload.ResultStatus,
		Comment:       payload.Comment,
		CheckedAt:     time.Now().UTC(),
	}
	if err := h.db.Create(audit).Error; err != nil {
		utils.JSONInternalError(c, "verification failed", err)
		return
	}
	application.Audits = append(application.Audits, *audit)

	var student models.Student
	h.db.First(&student, application.StudentID)
	message := fmt.Sprintf("ผลการตรวจสอบใบสมัครตำแหน่ง %s: ", application.Jobpost.Position)
	if payload.ResultStatus == "passed" {
		message += "ผ่านการตรวจสอบจากเจ้าหน้าที่"
	} else {
		message += "ไม่ผ่านการตรวจสอบจากเจ้าหน้าที่"
	}
	notifyUser(h.db, student.UserID, "ผลการตรวจสอบใบสมัครงาน", "application_verification", message)

	var employer models.Employer
	h.db.Select("company_name").First(&employer, application.Jobpost.UserID)
	name, university, _, _ := h.studentDisplayFields(application.StudentID)
	utils.JSONSuccess(c, http.StatusOK, mapAdminApplicationToResponse(application, employer.CompanyName, name, university))
}

// DeleteApplication removes one application sent to the current employer's job
// post, together with its review history and any interview booked for it.
//
// Rejecting an application keeps it on file; deleting is for clearing out records
// that should not be there at all. An application that already led to a hire is
// refused so an employment agreement is never left pointing at nothing.
func (h *ApplicationController) DeleteApplication(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	application, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}

	var interviewIDs []uint
	h.db.Model(&models.InterviewSchedule{}).Where("application_id = ?", application.ApplicationID).Pluck("interview_id", &interviewIDs)

	if len(interviewIDs) > 0 {
		var hires int64
		if err := h.db.Model(&models.EmploymentAgreement{}).Where("interview_schedule_id IN ?", interviewIDs).Count(&hires).Error; err != nil {
			utils.JSONInternalError(c, "delete failed", err)
			return
		}
		if hires > 0 {
			utils.JSONError(c, http.StatusBadRequest, "delete failed", "this application already led to an employment agreement and cannot be deleted")
			return
		}
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if len(interviewIDs) > 0 {
			if err := tx.Where("interview_schedule_id IN ?", interviewIDs).Delete(&models.Notification{}).Error; err != nil {
				return err
			}
			if err := tx.Where("interview_schedule_id IN ?", interviewIDs).Delete(&models.RescheduleInterview{}).Error; err != nil {
				return err
			}
			if err := tx.Where("interview_id IN ?", interviewIDs).Delete(&models.InterviewSchedule{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("application_id = ?", application.ApplicationID).Delete(&models.ApplicationAudit{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.Application{}, application.ApplicationID).Error
	}); err != nil {
		utils.JSONInternalError(c, "delete failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"deleted": true, "interviews_removed": len(interviewIDs)})
}

func (h *ApplicationController) loadApplicationForAdmin(c *gin.Context) (*models.Application, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid application id", "id must be a number")
		return nil, false
	}

	var application models.Application
	err = h.db.
		Preload("Jobpost").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		First(&application, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
		} else {
			utils.JSONInternalError(c, "failed to load application", err)
		}
		return nil, false
	}
	return &application, true
}

func (h *ApplicationController) currentAdmin(c *gin.Context) (*models.Admin, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}

	var admin models.Admin
	if err := h.db.Where("user_id = ?", userID).First(&admin).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusBadRequest, "action failed", "admin profile not found for current user")
		} else {
			utils.JSONInternalError(c, "action failed", err)
		}
		return nil, false
	}
	return &admin, true
}

func (h *ApplicationController) currentStudent(c *gin.Context) (*models.Student, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile before applying to jobs")
		} else {
			utils.JSONInternalError(c, "action failed", err)
		}
		return nil, false
	}
	return &student, true
}

func (h *ApplicationController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
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

func (h *ApplicationController) ownedByEmployer(c *gin.Context, employerID uint) (*models.Application, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid application id", "id must be a number")
		return nil, false
	}

	var application models.Application
	if err := h.db.
		Preload("Jobpost").
		Preload("Documents").
		Preload("Audits", func(db *gorm.DB) *gorm.DB { return db.Order("checked_at ASC") }).
		First(&application, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
		} else {
			utils.JSONInternalError(c, "failed to load application", err)
		}
		return nil, false
	}
	if application.Jobpost.UserID != employerID {
		utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
		return nil, false
	}

	return &application, true
}

// studentDisplayFields loads the student+account fields needed for an employer-facing response.
func (h *ApplicationController) studentDisplayFields(studentID uint) (name, university, phone, email string) {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return "", "", "", ""
	}
	name = fmt.Sprintf("%s %s", student.FirstName, student.LastName)
	university = student.University

	var user models.User
	if err := h.db.First(&user, student.UserID).Error; err == nil {
		phone = user.Phone
		email = user.Email
	}
	return name, university, phone, email
}

func mapApplicationToResponse(app *models.Application, companyName, studentName, studentUniversity, studentPhone, studentEmail string) dto.ApplicationResponse {
	applyDate := ""
	if app.ApplyDate != nil {
		applyDate = app.ApplyDate.Format(time.RFC3339)
	}

	documents := make([]dto.ApplicationDocumentResponse, 0, len(app.Documents))
	for _, d := range app.Documents {
		documents = append(documents, dto.ApplicationDocumentResponse{Name: d.Name, URL: d.URL})
	}

	audits := make([]dto.ApplicationAuditEntry, 0, len(app.Audits))
	for _, a := range app.Audits {
		audits = append(audits, dto.ApplicationAuditEntry{
			ResultStatus: a.ResultStatus,
			Comment:      a.Comment,
			CheckedAt:    a.CheckedAt.Format(time.RFC3339),
			ByAdmin:      a.AdminID != nil,
		})
	}

	return dto.ApplicationResponse{
		ID:                app.ApplicationID,
		JobpostID:         app.JobpostID,
		Position:          app.Jobpost.Position,
		CompanyName:       companyName,
		StudentID:         app.StudentID,
		StudentName:       studentName,
		StudentUniversity: studentUniversity,
		StudentPhone:      studentPhone,
		StudentEmail:      studentEmail,
		Remarks:           app.Remarks,
		Status:            app.Status,
		ApplyDate:         applyDate,
		Documents:         documents,
		Audits:            audits,
	}
}

func mapAdminApplicationToResponse(app *models.Application, companyName, studentName, studentUniversity string) dto.AdminApplicationResponse {
	reviewStatus := "awaiting"
	comment := ""
	checkedAt := ""
	for i := len(app.Audits) - 1; i >= 0; i-- {
		if app.Audits[i].AdminID != nil {
			reviewStatus = app.Audits[i].ResultStatus
			comment = app.Audits[i].Comment
			checkedAt = app.Audits[i].CheckedAt.Format(time.RFC3339)
			break
		}
	}

	return dto.AdminApplicationResponse{
		ID:                app.ApplicationID,
		JobpostID:         app.JobpostID,
		Position:          app.Jobpost.Position,
		CompanyName:       companyName,
		StudentID:         app.StudentID,
		StudentName:       studentName,
		StudentUniversity: studentUniversity,
		Status:            app.Status,
		ReviewStatus:      reviewStatus,
		Comment:           comment,
		CheckedAt:         checkedAt,
	}
}
