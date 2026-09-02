package dto

type RegisterRequest struct {
	UserName string `json:"user_name" validate:"required,min=2,max=100"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	Phone    string `json:"phone" validate:"omitempty,max=20"`
	Gender   string `json:"gender" validate:"omitempty,max=20"`
	Role     string `json:"role" validate:"omitempty,oneof=student employer admin"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required"` // Can be email or username
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}
