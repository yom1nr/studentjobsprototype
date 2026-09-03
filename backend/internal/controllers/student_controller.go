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
	} else {
		dob, perr := time.Parse("2006-01-02", payload.DateOfBirth)
		if perr != nil {
			utils.JSONError(c, http.StatusBadRequest, "invalid date_of_birth", "expected format YYYY-MM-DD")
			return
		}
		if dob.Year() < 1900 || dob.After(time.Now()) {
			utils.JSONError(c, http.StatusBadRequest, "invalid date_of_birth", "date is out of the accepted range")
			return
		}
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

// ExtractScheduleFromImage runs AI extraction on an uploaded class-schedule
// image and returns the class slots, computed free slots, and a ready-to-use
// available_time summary. Optional convenience — 503 when AI isn't configured so
// the UI falls back to manual entry.
func (h *StudentController) ExtractScheduleFromImage(c *gin.Context) {
	const maxBytes = 5 << 20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes+1024)
	if err := c.Request.ParseMultipartForm(maxBytes); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid image", "file too large (max 5MB) or malformed form")
		return
	}

	file, header, err := c.Request.FormFile("schedule_image")
	if err != nil {
		file, header, err = c.Request.FormFile("image")
	}
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid image", "attach the schedule as 'schedule_image'")
		return
	}
	defer file.Close()
	if header.Size > maxBytes {
		utils.JSONError(c, http.StatusBadRequest, "invalid image", "file too large (max 5MB)")
		return
	}

	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	ct := http.DetectContentType(head[:n])
	if ct != "image/jpeg" && ct != "image/png" && ct != "image/webp" {
		utils.JSONError(c, http.StatusBadRequest, "invalid image", "only JPG, PNG or WebP")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		utils.JSONInternalError(c, "extraction failed", err)
		return
	}
	imgBytes, err := io.ReadAll(io.LimitReader(file, maxBytes))
	if err != nil {
		utils.JSONInternalError(c, "extraction failed", err)
		return
	}

	result, err := utils.ExtractScheduleFromImage(c.Request.Context(), imgBytes, ct)
	if errors.Is(err, utils.ErrAINotConfigured) {
		// Friendly text goes in `message` — JSONError scrubs `detail` on 5xx.
		utils.JSONError(c, http.StatusServiceUnavailable,
			"ระบบสแกนตารางเรียนยังไม่พร้อมใช้งาน กรุณากรอกเวลาว่างเอง", "")
		return
	}
	if errors.Is(err, utils.ErrAIBusy) {
		utils.JSONError(c, http.StatusServiceUnavailable,
			"ระบบ AI ไม่ว่างชั่วคราว กรุณาลองใหม่อีกครั้ง หรือกรอกเวลาว่างเอง", "")
		return
	}
	if err != nil {
		utils.JSONInternalError(c, "could not read the schedule image", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, result)
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
