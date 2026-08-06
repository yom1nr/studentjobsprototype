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

    student, err := h.findByUserID(userID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load profile", err.Error())
        return
    }
    if student == nil {
        utils.JSONError(c, http.StatusNotFound, "student profile not found", "submit your profile first")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student))
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

    student, err := h.findByUserID(userID)
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

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student))
}

func (h *StudentController) findByUserID(userID uint) (*models.Student, error) {
    var student models.Student
    err := h.db.Where("user_id = ?", userID).First(&student).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &student, nil
}

func mapStudentToResponse(student *models.Student) *dto.StudentProfileResponse {
    return &dto.StudentProfileResponse{
        ID:         student.ID,
        UserID:     student.UserID,
        FirstName:  student.FirstName,
        LastName:   student.LastName,
        Address:    student.Address,
        University: student.University,
        Faculty:    student.Faculty,
        Major:      student.Major,
        Years:      student.Years,
        Skill:      student.Skill,
        CreatedAt:  student.CreatedAt.Format(time.RFC3339),
        UpdatedAt:  student.UpdatedAt.Format(time.RFC3339),
    }
}
