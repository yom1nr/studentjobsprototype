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
            utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
        }
        return
    }
    if jobpost.Status != "open" {
        utils.JSONError(c, http.StatusBadRequest, "create failed", "this job post is no longer accepting applications")
        return
    }

    var existing models.Application
    err := h.db.Where("student_id = ? AND jobpost_id = ?", student.ID, payload.JobpostID).First(&existing).Error
    if err == nil {
        utils.JSONError(c, http.StatusBadRequest, "create failed", "you have already applied to this job post")
        return
    } else if !errors.Is(err, gorm.ErrRecordNotFound) {
        utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
        return
    }

    now := time.Now().UTC()
    application := &models.Application{
        StudentID: student.ID,
        JobpostID: payload.JobpostID,
        ApplyDate: &now,
        Remarks:   payload.Remarks,
        Status:    "pending",
    }
    if err := h.db.Create(application).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
        return
    }
    application.Jobpost = jobpost

    var employer models.Employer
    h.db.Select("company_name").First(&employer, jobpost.EmployerID)

    utils.JSONSuccess(c, http.StatusCreated, mapApplicationToResponse(application, employer.CompanyName, "", "", "", ""))
}

// ListMyApplications returns the current student's own applications.
func (h *ApplicationController) ListMyApplications(c *gin.Context) {
    student, ok := h.currentStudent(c)
    if !ok {
        return
    }

    var applications []models.Application
    if err := h.db.Preload("Jobpost").Where("student_id = ?", student.ID).Order("created_at DESC").Find(&applications).Error; err != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to load applications", err.Error())
        return
    }

    responses := make([]dto.ApplicationResponse, 0, len(applications))
    for i := range applications {
        var employer models.Employer
        h.db.Select("company_name").First(&employer, applications[i].Jobpost.EmployerID)
        responses = append(responses, mapApplicationToResponse(&applications[i], employer.CompanyName, "", "", "", ""))
    }
    utils.JSONSuccess(c, http.StatusOK, responses)
}

// ListEmployerApplications returns applications submitted to the current employer's job posts.
func (h *ApplicationController) ListEmployerApplications(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    var jobpostIDs []uint
    h.db.Model(&models.Jobpost{}).Where("employer_id = ?", employer.ID).Pluck("id", &jobpostIDs)

    var applications []models.Application
    query := h.db.Preload("Jobpost").Order("created_at DESC")
    if len(jobpostIDs) > 0 {
        query = query.Where("jobpost_id IN ?", jobpostIDs)
    } else {
        query = query.Where("1 = 0")
    }
    if err := query.Find(&applications).Error; err != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to load applications", err.Error())
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
    application, ok := h.ownedByEmployer(c, employer.ID)
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
    application, ok := h.ownedByEmployer(c, employer.ID)
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
        ApplicationID: application.ID,
        ResultStatus:  payload.ResultStatus,
        Comment:       payload.Comment,
        CheckedAt:     time.Now().UTC(),
    }
    if err := h.db.Create(audit).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "review failed", err.Error())
        return
    }

    // "correction_requested" is feedback only — the application stays pending.
    if payload.ResultStatus == "accepted" || payload.ResultStatus == "rejected" {
        application.Status = payload.ResultStatus
        if err := h.db.Save(application).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "review failed", err.Error())
            return
        }
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
            utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
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
            utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
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
    if err := h.db.Preload("Jobpost").First(&application, id).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            utils.JSONError(c, http.StatusNotFound, "application not found", "no application exists with the given id")
        } else {
            utils.JSONError(c, http.StatusBadRequest, "failed to load application", err.Error())
        }
        return nil, false
    }
    if application.Jobpost.EmployerID != employerID {
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

    return dto.ApplicationResponse{
        ID:                app.ID,
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
    }
}
