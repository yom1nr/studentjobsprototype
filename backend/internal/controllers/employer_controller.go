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
        utils.JSONError(c, http.StatusBadRequest, "failed to load profile", err.Error())
        return
    }
    if employer == nil {
        utils.JSONError(c, http.StatusNotFound, "employer profile not found", "submit your company profile first")
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerToResponse(employer))
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
        utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
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

    if isNew {
        if err := h.db.Create(employer).Error; err != nil {
            utils.JSONError(c, http.StatusBadRequest, "update failed", err.Error())
            return
        }
        approve := &models.Approve{
            UserID:       employer.UserID,
            DateOfSignUp: time.Now().UTC(),
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

    // Upsert the verification documents.
    attachment := models.AttachmentEmployer{UserID: userID}
    if err := h.db.Where("user_id = ?", userID).First(&attachment).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
        utils.JSONInternalError(c, "update failed", err)
        return
    }
    attachment.CompanyRegis = payload.CompanyRegis
    attachment.Logo = payload.Logo
    attachment.CardID = payload.CardID
    if attachment.AttachmentEmployerID == 0 {
        h.db.Create(&attachment)
    } else {
        h.db.Save(&attachment)
    }
    employer.AttachmentEmployer = &attachment

    // FR2 loop: an employer who was asked for more documents and re-submits their
    // profile goes back into the pending review queue.
    if employer.Approve != nil && employer.Approve.Status == "request_document" {
        employer.Approve.Status = "pending"
        h.db.Save(employer.Approve)
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
    if employer.Approve != nil {
        status = employer.Approve.Status
    }
    companyRegis, logo, cardID := "", "", ""
    if employer.AttachmentEmployer != nil {
        companyRegis = employer.AttachmentEmployer.CompanyRegis
        logo = employer.AttachmentEmployer.Logo
        cardID = employer.AttachmentEmployer.CardID
    }

    return &dto.EmployerProfileResponse{
        ID:             employer.UserID,
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
