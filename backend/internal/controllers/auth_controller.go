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

const (
    msgValidationError    = "validation error"
    msgRegistrationFailed = "registration failed"
    msgLoginFailed        = "login failed"
)

// AuthController manages authentication endpoints.
type AuthController struct {
    db          *gorm.DB
    jwtProvider utils.JWTProvider
    validate    *validator.Validate
}

// NewAuthController creates a new AuthController.
func NewAuthController(db *gorm.DB, jwtProvider utils.JWTProvider) *AuthController {
    return &AuthController{
        db:          db,
        jwtProvider: jwtProvider,
        validate:    validator.New(),
    }
}

// Register creates a new user account.
func (h *AuthController) Register(c *gin.Context) {
    var payload dto.RegisterRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }

    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgValidationError, err.Error())
        return
    }
    if err := utils.ValidatePasswordStrength(payload.Password); err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgValidationError, err.Error())
        return
    }

    // Defence in depth: the DTO already rejects "admin", but never trust the
    // client for the role — an empty/omitted role registers as a student.
    if payload.Role != "student" && payload.Role != "employer" {
        payload.Role = "student"
    }

    existing, err := h.findByEmail(payload.Email)
    if err != nil {
        utils.JSONInternalError(c, msgRegistrationFailed, err)
        return
    }
    if existing != nil {
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, "email already registered")
        return
    }

    hashedPassword, err := utils.HashPassword(payload.Password)
    if err != nil {
        utils.JSONInternalError(c, msgRegistrationFailed, err)
        return
    }

    user := &models.User{
        UserName: payload.UserName,
        Email:    payload.Email,
        Password: hashedPassword,
        Phone:    payload.Phone,
        Gender:   payload.Gender,
        Role:     payload.Role,
    }

    if err := h.db.Create(user).Error; err != nil {
        utils.JSONInternalError(c, msgRegistrationFailed, err)
        return
    }

    token, err := h.jwtProvider.GenerateToken(user.UserID, user.Role)
    if err != nil {
        utils.JSONInternalError(c, msgRegistrationFailed, err)
        return
    }

    utils.JSONSuccess(c, http.StatusCreated, dto.AuthResponse{
        Token: token,
        User: dto.UserResponse{
            ID:        user.UserID,
            UserName:  user.UserName,
            Email:     user.Email,
            Phone:     user.Phone,
            Gender:    user.Gender,
            Avatar:    user.Avatar,
            Role:      user.Role,
            CreatedAt: user.CreatedAt.Format(time.RFC3339),
            UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
        },
    })
}

// Login authenticates a user and returns a JWT token.
func (h *AuthController) Login(c *gin.Context) {
    var payload dto.LoginRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }

    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgValidationError, err.Error())
        return
    }

    user, err := h.findByIdentifier(payload.Email)
    if err != nil {
        utils.JSONInternalError(c, msgLoginFailed, err)
        return
    }
    if user == nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, "invalid email/username or password")
        return
    }

    if err := utils.ComparePassword(user.Password, payload.Password); err != nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, "invalid email or password")
        return
    }

    token, err := h.jwtProvider.GenerateToken(user.UserID, user.Role)
    if err != nil {
        utils.JSONInternalError(c, msgLoginFailed, err)
        return
    }

    utils.JSONSuccess(c, http.StatusOK, dto.AuthResponse{
        Token: token,
        User: dto.UserResponse{
            ID:        user.UserID,
            UserName:  user.UserName,
            Email:     user.Email,
            Phone:     user.Phone,
            Gender:    user.Gender,
            Avatar:    user.Avatar,
            Role:      user.Role,
            CreatedAt: user.CreatedAt.Format(time.RFC3339),
            UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
        },
    })
}

// findByIdentifier looks a user up by email or username, so people can sign in
// with either.
func (h *AuthController) findByIdentifier(identifier string) (*models.User, error) {
    var user models.User
    err := h.db.Where("email = ? OR user_name = ?", identifier, identifier).First(&user).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &user, nil
}

func (h *AuthController) findByEmail(email string) (*models.User, error) {
    var user models.User
    err := h.db.Where("email = ?", email).First(&user).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &user, nil
}
