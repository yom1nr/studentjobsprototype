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

// StudentController manages the current student's profile.
type StudentController struct {
    db       *gorm.DB
    validate *validator.Validate
}

// NewStudentController creates a new StudentController.
func NewStudentController(db *gorm.DB) *StudentController {
    return &StudentController{db: db, validate: validator.New()}
}

// GetMyProfile returns the current student's profile.
func (h *StudentController) GetMyProfile(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    student, attachment, err := h.findByUserID(userID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load profile", err.Error())
        return
    }
    if student == nil {
        utils.JSONError(c, http.StatusNotFound, "student profile not found", "submit your profile first")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student, attachment))
}

// UpsertMyProfile creates or updates the current student's profile.
func (h *StudentController) UpsertMyProfile(c *gin.Context) {
    userID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return
    }

    var payload dto.StudentProfileRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }

    student, _, err := h.findByUserID(userID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
        return
    }

    isNew := student == nil
    if isNew {
        student = &models.Student{UserID: userID}
    }

    student.FirstName = payload.FirstName
    student.LastName = payload.LastName
    
    if payload.DateOfBirth != "" {
        if parsed, err := time.Parse("2006-01-02", payload.DateOfBirth); err == nil {
            student.DateOfBirth = &parsed
        }
    } else {
        student.DateOfBirth = nil
    }

    student.Address = payload.Address
    student.University = payload.University
    student.Faculty = payload.Faculty
    student.Major = payload.Major
    student.Years = payload.Years
    student.Skill = payload.Skill

    if isNew {
        if err := h.db.Create(student).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
    } else if err := h.db.Save(student).Error; err != nil {
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
        return
    }

    if payload.ProfilePicture != "" {
        if err := h.db.Model(&models.User{}).Where("user_id = ?", userID).Update("profile_picture", payload.ProfilePicture).Error; err != nil {
            utils.JSONError(c, http.StatusInternalServerError, "failed to update profile picture", err.Error())
            return
        }
    }

    var attachment models.AttachmentStudent
    err = h.db.Where("user_id = ?", userID).First(&attachment).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            attachment = models.AttachmentStudent{UserID: userID}
        } else {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
    }

    attachment.Schedule = payload.Schedule
    attachment.Transcript = payload.Transcript
    attachment.Resume = payload.Resume

    if attachment.AttachmentStudentID == 0 {
        h.db.Create(&attachment)
    } else {
        h.db.Save(&attachment)
    }

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student, &attachment))
}

func (h *StudentController) findByUserID(userID uint) (*models.Student, *models.AttachmentStudent, error) {
    var student models.Student
    err := h.db.Where("user_id = ?", userID).First(&student).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil, nil
        }
        return nil, nil, err
    }
    
    var attachment models.AttachmentStudent
    h.db.Where("user_id = ?", userID).First(&attachment)
    return &student, &attachment, nil
}

func mapStudentToResponse(student *models.Student, attachment *models.AttachmentStudent) *dto.StudentProfileResponse {
    var dob string
    if student.DateOfBirth != nil {
        dob = student.DateOfBirth.Format("2006-01-02")
    }

    schedule := ""
    transcript := ""
    resume := ""
    if attachment != nil {
        schedule = attachment.Schedule
        transcript = attachment.Transcript
        resume = attachment.Resume
    }

    return &dto.StudentProfileResponse{
<<<<<<< Updated upstream
        ID:         student.ID,
        UserID:     student.UserID,
        FirstName:  student.FirstName,
        LastName:   student.LastName,
        Address:    student.Address,
        University: student.University,
=======
        ID:          student.UserID,
        UserID:      student.UserID,
        FirstName:   student.FirstName,
        LastName:    student.LastName,
        DateOfBirth: dob,
        Address:     student.Address,
        University:  student.University,
>>>>>>> Stashed changes
        Faculty:    student.Faculty,
        Major:      student.Major,
        Years:      student.Years,
        Skill:      student.Skill,
        Schedule:   schedule,
        Transcript: transcript,
        Resume:     resume,
        CreatedAt:  student.CreatedAt.Format(time.RFC3339),
        UpdatedAt:  student.UpdatedAt.Format(time.RFC3339),
    }
}
