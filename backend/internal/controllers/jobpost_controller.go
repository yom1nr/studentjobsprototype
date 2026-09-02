package controllers

import (
    "errors"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/go-playground/validator/v10"
    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/dto"
    "github.com/SA/Golang-Backend-Example/internal/models"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// JobpostController manages job postings — public browsing plus the owning employer's CRUD.
type JobpostController struct {
    db       *gorm.DB
    validate *validator.Validate
}

// NewJobpostController creates a new JobpostController.
func NewJobpostController(db *gorm.DB) *JobpostController {
    return &JobpostController{db: db, validate: validator.New()}
}

// ListOpenJobposts returns open job postings for students to browse.
func (h *JobpostController) ListOpenJobposts(c *gin.Context) {
    var jobposts []models.Jobpost
    if err := h.db.Where("status = ?", "open").Order("created_at DESC").Find(&jobposts).Error; err != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to load job posts", err.Error())
        return
    }

    responses := make([]dto.JobpostResponse, 0, len(jobposts))
    for _, j := range jobposts {
        responses = append(responses, h.mapWithCompanyName(&j))
    }
    utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetJobpostDetail returns one job posting by ID.
func (h *JobpostController) GetJobpostDetail(c *gin.Context) {
    id, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid job post id", "id must be a number")
        return
    }

    jobpost, err := h.findByID(id)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load job post", err.Error())
        return
    }
    if jobpost == nil {
        utils.JSONError(c, http.StatusNotFound, "job post not found", "no job post exists with the given id")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, h.mapWithCompanyName(jobpost))
}

// ListMyJobposts returns every job posting owned by the current employer, any status.
func (h *JobpostController) ListMyJobposts(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    var jobposts []models.Jobpost
    if err := h.db.Where("user_id = ?", employer.UserID).Order("created_at DESC").Find(&jobposts).Error; err != nil {
        utils.JSONError(c, http.StatusInternalServerError, "failed to load job posts", err.Error())
        return
    }

    responses := make([]dto.JobpostResponse, 0, len(jobposts))
    for _, j := range jobposts {
        responses = append(responses, mapJobpostToResponse(&j, employer.CompanyName))
    }
    utils.JSONSuccess(c, http.StatusOK, responses)
}

// CreateJobpost creates a new job posting owned by the current employer.
func (h *JobpostController) CreateJobpost(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    var payload dto.UpsertJobpostRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }

    dateStart, err := parseOptionalDate(payload.DateStart)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", "date_start must be RFC3339")
        return
    }

    jobpost := &models.Jobpost{
        UserID:         employer.UserID,
        Position:       payload.Position,
        JobType:        payload.JobType,
        JobDescription: payload.JobDescription,
        DateStart:      dateStart,
        Wage:           payload.Wage,
        Period:         payload.Period,
        Location:       payload.Location,
        Welfare:        payload.Welfare,
        Property:       payload.Property,
        Quantity:       max(payload.Quantity, 1),
        Status:         "open",
    }
    if err := h.db.Create(jobpost).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusCreated, mapJobpostToResponse(jobpost, employer.CompanyName))
}

// UpdateJobpost edits a job posting owned by the current employer.
func (h *JobpostController) UpdateJobpost(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    jobpost, ok := h.ownedJobpost(c, employer.UserID)
    if !ok {
        return
    }

    var payload dto.UpsertJobpostRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }

    dateStart, err := parseOptionalDate(payload.DateStart)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", "date_start must be RFC3339")
        return
    }

    jobpost.Position = payload.Position
    jobpost.JobType = payload.JobType
    jobpost.JobDescription = payload.JobDescription
    jobpost.DateStart = dateStart
    jobpost.Wage = payload.Wage
    jobpost.Period = payload.Period
    jobpost.Location = payload.Location
    jobpost.Welfare = payload.Welfare
    jobpost.Property = payload.Property
    jobpost.Quantity = max(payload.Quantity, 1)

    if err := h.db.Save(jobpost).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapJobpostToResponse(jobpost, employer.CompanyName))
}

// CloseJobpost closes a job posting owned by the current employer (stops accepting applications).
func (h *JobpostController) CloseJobpost(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    jobpost, ok := h.ownedJobpost(c, employer.UserID)
    if !ok {
        return
    }

    jobpost.Status = "closed"
    if err := h.db.Save(jobpost).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "close failed", err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapJobpostToResponse(jobpost, employer.CompanyName))
}

// DeleteJobpost removes a job posting owned by the current employer along with
// everything that hangs off it — the applications sent to it, their audit trail,
// and any interviews booked for those applications.
//
// Closing a post keeps it in the records; deleting is for clearing out posts that
// should never have been there. A post that already led to a hire is refused, so
// an employment agreement can never be left pointing at a vanished position.
func (h *JobpostController) DeleteJobpost(c *gin.Context) {
    employer, ok := h.currentEmployer(c)
    if !ok {
        return
    }

    jobpost, ok := h.ownedJobpost(c, employer.UserID)
    if !ok {
        return
    }

    var applicationIDs []uint
    h.db.Model(&models.Application{}).Where("jobpost_id = ?", jobpost.JobpostID).Pluck("application_id", &applicationIDs)

    var interviewIDs []uint
    if len(applicationIDs) > 0 {
        h.db.Model(&models.InterviewSchedule{}).Where("application_id IN ?", applicationIDs).Pluck("interview_id", &interviewIDs)
    }

    if len(interviewIDs) > 0 {
        var hires int64
        if err := h.db.Model(&models.EmploymentAgreement{}).Where("interview_schedule_id IN ?", interviewIDs).Count(&hires).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "delete failed", err.Error())
            return
        }
        if hires > 0 {
            utils.JSONError(c, http.StatusBadRequest, "delete failed", "this job post already led to an employment agreement — close it instead of deleting")
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
        if len(applicationIDs) > 0 {
            if err := tx.Where("application_id IN ?", applicationIDs).Delete(&models.ApplicationAudit{}).Error; err != nil {
                return err
            }
            if err := tx.Where("application_id IN ?", applicationIDs).Delete(&models.Application{}).Error; err != nil {
                return err
            }
        }
        return tx.Delete(&models.Jobpost{}, jobpost.JobpostID).Error
    }); err != nil {
        utils.JSONInternalError(c, "delete failed", err)
        return
    }

    utils.JSONSuccess(c, http.StatusOK, gin.H{
        "deleted":              true,
        "applications_removed": len(applicationIDs),
        "interviews_removed":   len(interviewIDs),
    })
}

func (h *JobpostController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return nil, false
    }

    var employer models.Employer
    if err := h.db.Where("user_id = ?", userID).First(&employer).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your company profile before managing job posts")
        } else {
            utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
        }
        return nil, false
    }

    return &employer, true
}

func (h *JobpostController) ownedJobpost(c *gin.Context, employerID uint) (*models.Jobpost, bool) {
    id, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid job post id", "id must be a number")
        return nil, false
    }

    jobpost, err := h.findByID(id)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load job post", err.Error())
        return nil, false
    }
    if jobpost == nil || jobpost.UserID != employerID {
        utils.JSONError(c, http.StatusNotFound, "job post not found", "no job post exists with the given id")
        return nil, false
    }

    return jobpost, true
}

func (h *JobpostController) findByID(id uint) (*models.Jobpost, error) {
    var jobpost models.Jobpost
    err := h.db.First(&jobpost, id).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &jobpost, nil
}

func (h *JobpostController) mapWithCompanyName(jobpost *models.Jobpost) dto.JobpostResponse {
    var employer models.Employer
    companyName := ""
    if err := h.db.Select("company_name").First(&employer, jobpost.UserID).Error; err == nil {
        companyName = employer.CompanyName
    }
    return mapJobpostToResponse(jobpost, companyName)
}

func mapJobpostToResponse(jobpost *models.Jobpost, companyName string) dto.JobpostResponse {
    var dateStart *string
    if jobpost.DateStart != nil {
        formatted := jobpost.DateStart.Format(time.RFC3339)
        dateStart = &formatted
    }

    return dto.JobpostResponse{
        ID:             jobpost.JobpostID,
        EmployerID:     jobpost.UserID,
        CompanyName:    companyName,
        Position:       jobpost.Position,
        JobType:        jobpost.JobType,
        JobDescription: jobpost.JobDescription,
        DateStart:      dateStart,
        Wage:           jobpost.Wage,
        Period:         jobpost.Period,
        Location:       jobpost.Location,
        Welfare:        jobpost.Welfare,
        Property:       jobpost.Property,
        Quantity:       jobpost.Quantity,
        Status:         jobpost.Status,
        CreatedAt:      jobpost.CreatedAt.Format(time.RFC3339),
    }
}

func parseOptionalDate(value string) (*time.Time, error) {
    if value == "" {
        return nil, nil
    }
    parsed, err := time.Parse(time.RFC3339, value)
    if err != nil {
        return nil, err
    }
    return &parsed, nil
}
