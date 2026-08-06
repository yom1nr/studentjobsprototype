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

    existing, err := h.findByEmail(payload.Email)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, err.Error())
        return
    }
    if existing != nil {
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, "email already registered")
        return
    }

    hashedPassword, err := utils.HashPassword(payload.Password)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, err.Error())
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
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, err.Error())
        return
    }

    token, err := h.jwtProvider.GenerateToken(user.ID, user.Role)
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, msgRegistrationFailed, err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusCreated, dto.AuthResponse{
        Token: token,
        User: dto.UserResponse{
            ID:        user.ID,
            UserName:  user.UserName,
            Email:     user.Email,
            Phone:     user.Phone,
            Gender:    user.Gender,
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

    user, err := h.findByEmail(payload.Email)
    if err != nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, err.Error())
        return
    }
    if user == nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, "invalid email or password")
        return
    }

    if err := utils.ComparePassword(user.Password, payload.Password); err != nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, "invalid email or password")
        return
    }

    token, err := h.jwtProvider.GenerateToken(user.ID, user.Role)
    if err != nil {
        utils.JSONError(c, http.StatusUnauthorized, msgLoginFailed, err.Error())
        return
    }

    utils.JSONSuccess(c, http.StatusOK, dto.AuthResponse{
        Token: token,
        User: dto.UserResponse{
            ID:        user.ID,
            UserName:  user.UserName,
            Email:     user.Email,
            Phone:     user.Phone,
            Gender:    user.Gender,
            Role:      user.Role,
            CreatedAt: user.CreatedAt.Format(time.RFC3339),
            UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
        },
    })
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
