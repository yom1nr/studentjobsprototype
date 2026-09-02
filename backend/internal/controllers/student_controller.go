package controllers

import (
	"errors"
	"io"
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

	utils.JSONSuccess(c, http.StatusOK, h.mapStudentToResponse(student))
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
	student.AvailableTime = payload.AvailableTime
	if payload.ProfileImage != "" {
		student.ProfileImage = payload.ProfileImage
	}

	if payload.DateOfBirth != "" {
		if t, err := time.Parse("2006-01-02", payload.DateOfBirth); err == nil {
			student.DateOfBirth = &t
		} else if t, err := time.Parse(time.RFC3339, payload.DateOfBirth); err == nil {
			student.DateOfBirth = &t
		}
	}

	// Update base User model fields (phone, gender)
	var user models.User
	if err := h.db.First(&user, userID).Error; err == nil {
		updatedUser := false
		if payload.Gender != "" && payload.Gender != user.Gender {
			user.Gender = payload.Gender
			updatedUser = true
		}
		if payload.Phone != "" && payload.Phone != user.Phone {
			user.Phone = payload.Phone
			updatedUser = true
		}
		if updatedUser {
			h.db.Save(&user)
		}
	}

	if isNew {
		if err := h.db.Create(student).Error; err != nil {
			utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
			return
		}
	} else if err := h.db.Save(student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapStudentToResponse(student))
}

// ExtractScheduleFromImage processes class schedule images using AI
func (h *StudentController) ExtractScheduleFromImage(c *gin.Context) {
	file, err := c.FormFile("schedule_image")
	if err != nil {
		file, err = c.FormFile("image")
	}
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid image file", "schedule_image field is required")
		return
	}

	f, err := file.Open()
	if err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to open image", err.Error())
		return
	}
	defer f.Close()

	imgBytes, err := io.ReadAll(f)
	if err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to read image", err.Error())
		return
	}

	result, err := utils.ExtractScheduleFromImage(c.Request.Context(), imgBytes, file.Header.Get("Content-Type"))
	if err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "AI extraction failed", err.Error())
		return
	}

	utils.JSONSuccess(c, http.StatusOK, result)
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

func (h *StudentController) mapStudentToResponse(student *models.Student) *dto.StudentProfileResponse {
	var user models.User
	h.db.First(&user, student.UserID)

	dobStr := ""
	ageVal := 0
	if student.DateOfBirth != nil {
		dobStr = student.DateOfBirth.Format("2006-01-02")
		today := time.Now().UTC()
		ageVal = today.Year() - student.DateOfBirth.Year()
		if today.YearDay() < student.DateOfBirth.YearDay() {
			ageVal--
		}
		if ageVal < 0 {
			ageVal = 0
		}
	}

	return &dto.StudentProfileResponse{
		ID:            student.UserID,
		UserID:        student.UserID,
		FirstName:     student.FirstName,
		LastName:      student.LastName,
		DateOfBirth:   dobStr,
		Age:           ageVal,
		Gender:        user.Gender,
		Phone:         user.Phone,
		Address:       student.Address,
		University:    student.University,
		Faculty:       student.Faculty,
		Major:         student.Major,
		Years:         student.Years,
		Skill:         student.Skill,
		AvailableTime: student.AvailableTime,
		ProfileImage:  student.ProfileImage,
		CreatedAt:     student.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     student.UpdatedAt.Format(time.RFC3339),
	}
}
