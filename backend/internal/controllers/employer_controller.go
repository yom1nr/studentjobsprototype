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

    employer, attachment, err := h.findByUserID(userID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "failed to load profile", err.Error())
        return
    }
    if employer == nil {
        utils.JSONError(c, http.StatusNotFound, "employer profile not found", "submit your company profile first")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerToResponse(employer, attachment))
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

    employer, _, err := h.findByUserID(userID)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
        return
    }

    var conflicting models.Employer
    conflictQuery := h.db.Where("tax_id = ?", payload.TaxID)
    if employer != nil {
<<<<<<< Updated upstream
        conflictQuery = conflictQuery.Where("id != ?", employer.ID)
=======
        conflictQuery = conflictQuery.Where("user_id != ?", employer.UserID)
>>>>>>> Stashed changes
    }
    if err := conflictQuery.First(&conflicting).Error; err == nil {
        utils.JSONError(c, http.StatusBadRequest, "update failed", "tax id already registered to another employer")
        return
    } else if !errors.Is(err, gorm.ErrRecordNotFound) {
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
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

    if !isNew {
        var existing models.Employer
        if err := h.db.Where("tax_id = ? AND user_id != ?", payload.TaxID, employer.UserID).First(&existing).Error; err == nil {
            utils.JSONError(c, http.StatusBadRequest, "Tax ID already in use", "Tax ID already in use")
            return
        }
    }

    if isNew {
        if err := h.db.Create(employer).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
        approve := &models.Approve{
            EmployerID:   employer.ID,
            DateOfSignUp: time.Now().UTC().Format(time.RFC3339),
            Status:       "pending",
        }
        if err := h.db.Create(approve).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
        employer.Approve = approve
    } else {
        if err := h.db.Save(employer).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
    }

    // Handle AttachmentEmployer
    var attachment models.AttachmentEmployer
    err = h.db.Where("user_id = ?", userID).First(&attachment).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            attachment = models.AttachmentEmployer{UserID: userID}
        } else {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
    }

    attachment.CompanyRegis = payload.CompanyRegis
    attachment.Logo = payload.Logo
    attachment.CardID = payload.CardID

    if attachment.AttachmentEmployerID == 0 {
        h.db.Create(&attachment)
    } else {
        h.db.Save(&attachment)
    }

    // If status was request_document, moving it back to pending might be desired,
    // but the requirement says "later edits leave the existing approval status untouched" or we should change it to pending if they re-submitted?
    // Let's change it back to pending if it was request_document.
    if employer.Approve != nil && employer.Approve.Status == "request_document" {
        employer.Approve.Status = "pending"
        h.db.Save(employer.Approve)
    }

    if payload.ProfilePicture != "" {
        if err := h.db.Model(&models.User{}).Where("user_id = ?", userID).Update("profile_picture", payload.ProfilePicture).Error; err != nil {
            utils.JSONError(c, http.StatusInternalServerError, "failed to update profile picture", err.Error())
            return
        }
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerToResponse(employer, &attachment))
}

func (h *EmployerController) findByUserID(userID uint) (*models.Employer, *models.AttachmentEmployer, error) {
    var employer models.Employer
    err := h.db.Preload("Approve").Where("user_id = ?", userID).First(&employer).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil, nil
        }
        return nil, nil, err
    }
    
    var attachment models.AttachmentEmployer
    h.db.Where("user_id = ?", userID).First(&attachment)
    return &employer, &attachment, nil
}

func mapEmployerToResponse(employer *models.Employer, attachment *models.AttachmentEmployer) *dto.EmployerProfileResponse {
    status := ""
    if employer.Approve != nil {
        status = employer.Approve.Status
    }

    companyRegis := ""
    logo := ""
    cardID := ""
    if attachment != nil {
        companyRegis = attachment.CompanyRegis
        logo = attachment.Logo
        cardID = attachment.CardID
    }

    return &dto.EmployerProfileResponse{
        ID:             employer.ID,
        UserID:         employer.UserID,
        FirstName:      employer.FirstName,
        LastName:       employer.LastName,
        Position:       employer.Position,
        LineID:         employer.LineID,
        CompanyName:    employer.CompanyName,
        BusinessType:   employer.BusinessType,
        TaxID:          employer.TaxID,
        Link:           employer.Link,
        CompanyAddress: employer.CompanyAddress,
        CompanyRegis:   companyRegis,
        Logo:           logo,
        CardID:         cardID,
        ApproveStatus:  status,
        CreatedAt:      employer.CreatedAt.Format(time.RFC3339),
        UpdatedAt:      employer.UpdatedAt.Format(time.RFC3339),
    }
}
