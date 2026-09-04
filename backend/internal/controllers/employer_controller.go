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

// EmployerController manages the current employer's company profile.
type EmployerController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewEmployerController creates a new EmployerController.
func NewEmployerController(db *gorm.DB) *EmployerController {
	return &EmployerController{db: db, validate: validator.New()}
}

// GetMyProfile returns the current employer's company profile.
func (h *EmployerController) GetMyProfile(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	employer, err := h.findByUserID(userID)
	if err != nil {
		utils.JSONInternalError(c, "failed to load profile", err)
		return
	}
	if employer == nil {
		utils.JSONError(c, http.StatusNotFound, "employer profile not found", "submit your company profile first")
		return
	}

	utils.JSONSuccess(c, http.StatusOK, mapEmployerToResponse(employer))
}

// AcknowledgeRequestNote marks the admin's "request more documents" note as read
// by the current employer. No-op unless the account is in "request_document".
func (h *EmployerController) AcknowledgeRequestNote(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	var approve models.Approve
	if err := h.db.Where("user_id = ?", userID).First(&approve).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "approval record not found", "submit your company profile first")
		return
	}
	if approve.Status == "request_document" && approve.RequestNoteAckAt == nil {
		now := time.Now().UTC()
		approve.RequestNoteAckAt = &now
		if err := h.db.Save(&approve).Error; err != nil {
			utils.JSONInternalError(c, "could not save acknowledgement", err)
			return
		}
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"request_note_acknowledged": approve.RequestNoteAckAt != nil})
}

// UpsertMyProfile creates or updates the current employer's company profile.
// The first submission also opens an Approve record with status "pending" for
// admin review; later edits leave the existing approval status untouched.
func (h *EmployerController) UpsertMyProfile(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	var payload dto.EmployerProfileRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	employer, err := h.findByUserID(userID)
	if err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	var conflicting models.Employer
	conflictQuery := h.db.Where("tax_id = ?", payload.TaxID)
	if employer != nil {
		conflictQuery = conflictQuery.Where("user_id != ?", employer.UserID)
	}
	if err := conflictQuery.First(&conflicting).Error; err == nil {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "tax id already registered to another employer")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	isNew := employer == nil
	if isNew {
		employer = &models.Employer{UserID: userID}
	}

	employer.FirstName = payload.FirstName
	employer.LastName = payload.LastName
	employer.Position = payload.Position
	employer.LineID = payload.LineID
	employer.CompanyName = payload.CompanyName
	employer.BusinessType = payload.BusinessType
	employer.TaxID = payload.TaxID
	employer.Link = payload.Link
	employer.CompanyAddress = payload.CompanyAddress

	// Employer profile, its Approve record (new submissions only), and its
	// attachment upsert all have to land together — a failure partway through
	// used to leave e.g. an employer row with no Approve record (stuck
	// invisible to the admin review queue) or saved profile fields next to a
	// half-written attachment.
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if isNew {
			if err := tx.Create(employer).Error; err != nil {
				return err
			}
			approve := &models.Approve{
				UserID:       employer.UserID,
				DateOfSignUp: time.Now().UTC(),
				Status:       "pending",
			}
			if err := tx.Create(approve).Error; err != nil {
				return err
			}
			employer.Approve = approve
		} else {
			if err := tx.Save(employer).Error; err != nil {
				return err
			}
		}

		// Upsert the verification documents.
		attachment := models.AttachmentEmployer{UserID: userID}
		if err := tx.Where("user_id = ?", userID).First(&attachment).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		attachment.CompanyRegis = payload.CompanyRegis
		attachment.Logo = payload.Logo
		attachment.CardID = payload.CardID
		var attachErr error
		if attachment.AttachmentEmployerID == 0 {
			attachErr = tx.Create(&attachment).Error
		} else {
			attachErr = tx.Save(&attachment).Error
		}
		if attachErr != nil {
			return attachErr
		}
		employer.AttachmentEmployer = &attachment

		// FR2 loop: an employer who was asked for more documents and re-submits
		// their profile goes back into the pending review queue.
		if employer.Approve != nil && employer.Approve.Status == "request_document" {
			employer.Approve.Status = "pending"
			if err := tx.Save(employer.Approve).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, mapEmployerToResponse(employer))
}

func (h *EmployerController) findByUserID(userID uint) (*models.Employer, error) {
	var employer models.Employer
	err := h.db.Preload("Approve").Preload("AttachmentEmployer").Where("user_id = ?", userID).First(&employer).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &employer, nil
}

func mapEmployerToResponse(employer *models.Employer) *dto.EmployerProfileResponse {
	status := ""
	requestNote := ""
	requestNoteAck := false
	if employer.Approve != nil {
		status = employer.Approve.Status
		requestNote = employer.Approve.RequestNote
		requestNoteAck = employer.Approve.RequestNoteAckAt != nil
	}
	companyRegis, logo, cardID := "", "", ""
	if employer.AttachmentEmployer != nil {
		companyRegis = employer.AttachmentEmployer.CompanyRegis
		logo = employer.AttachmentEmployer.Logo
		cardID = employer.AttachmentEmployer.CardID
	}

	return &dto.EmployerProfileResponse{
		ID:                      employer.UserID,
		UserID:                  employer.UserID,
		FirstName:               employer.FirstName,
		LastName:                employer.LastName,
		Position:                employer.Position,
		LineID:                  employer.LineID,
		CompanyName:             employer.CompanyName,
		BusinessType:            employer.BusinessType,
		TaxID:                   employer.TaxID,
		Link:                    employer.Link,
		CompanyAddress:          employer.CompanyAddress,
		CompanyRegis:            companyRegis,
		Logo:                    logo,
		CardID:                  cardID,
		ApproveStatus:           status,
		RequestNote:             requestNote,
		RequestNoteAcknowledged: requestNoteAck,
		CreatedAt:               employer.CreatedAt.Format(time.RFC3339),
		UpdatedAt:               employer.UpdatedAt.Format(time.RFC3339),
	}
}
