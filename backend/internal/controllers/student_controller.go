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
        utils.JSONInternalError(c, "failed to load profile", err)
        return
    }
    if student == nil {
        utils.JSONError(c, http.StatusNotFound, "student profile not found", "submit your profile first")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student))
}

// UpsertMyProfile creates or updates the current student's profile. Phone,
// gender and avatar are mirrored onto the User account.
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
        utils.JSONInternalError(c, "update failed", err)
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
    student.AvailableTime = payload.AvailableTime

    if payload.DateOfBirth == "" {
        student.DateOfBirth = nil
    } else if dob, perr := time.Parse("2006-01-02", payload.DateOfBirth); perr == nil {
        student.DateOfBirth = &dob
    }

    // Mirror the account-level fields onto the User row.
    var user models.User
    if err := h.db.First(&user, userID).Error; err != nil {
        utils.JSONInternalError(c, "update failed", err)
        return
    }
    changed := false
    if payload.Phone != "" && payload.Phone != user.Phone {
        user.Phone, changed = payload.Phone, true
    }
    if payload.Gender != "" && payload.Gender != user.Gender {
        user.Gender, changed = payload.Gender, true
    }
    if payload.Avatar != "" && payload.Avatar != user.Avatar {
        user.Avatar, changed = payload.Avatar, true
    }

    txErr := h.db.Transaction(func(tx *gorm.DB) error {
        if isNew {
            if err := tx.Create(student).Error; err != nil {
                return err
            }
        } else if err := tx.Save(student).Error; err != nil {
            return err
        }
        if changed {
            return tx.Save(&user).Error
        }
        return nil
    })
    if txErr != nil {
        utils.JSONInternalError(c, "update failed", txErr)
        return
    }
    student.User = &user

    utils.JSONSuccess(c, http.StatusOK, mapStudentToResponse(student))
}

func (h *StudentController) findByUserID(userID uint) (*models.Student, error) {
    var student models.Student
    err := h.db.Preload("User").Where("user_id = ?", userID).First(&student).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &student, nil
}

func mapStudentToResponse(student *models.Student) *dto.StudentProfileResponse {
    dob, age := "", 0
    if student.DateOfBirth != nil {
        dob = student.DateOfBirth.Format("2006-01-02")
        age = utils.CalcAge(*student.DateOfBirth)
    }

    gender, phone, avatar := "", "", ""
    if student.User != nil {
        gender = student.User.Gender
        phone = student.User.Phone
        avatar = student.User.Avatar
    }

    return &dto.StudentProfileResponse{
        ID:            student.UserID,
        UserID:        student.UserID,
        FirstName:     student.FirstName,
        LastName:      student.LastName,
        DateOfBirth:   dob,
        Age:           age,
        Gender:        gender,
        Phone:         phone,
        Address:       student.Address,
        University:    student.University,
        Faculty:       student.Faculty,
        Major:         student.Major,
        Years:         student.Years,
        Skill:         student.Skill,
        AvailableTime: student.AvailableTime,
        Avatar:        avatar,
        CreatedAt:     student.CreatedAt.Format(time.RFC3339),
        UpdatedAt:     student.UpdatedAt.Format(time.RFC3339),
    }
}
