package dto

type RegisterRequest struct {
	UserName string `json:"user_name" validate:"required,min=2,max=100"`
	Email    string `json:"email" validate:"required,email"`
	// Also checked by utils.ValidatePasswordStrength (letters + digits) for a
	// clearer message; containsany here is a fast fail on the digit rule.
	Password string `json:"password" validate:"required,min=8,max=72,containsany=0123456789"`
	Phone    string `json:"phone" validate:"omitempty,max=20"`
	Gender   string `json:"gender" validate:"omitempty,max=20"`
	// admin accounts are provisioned by the seeder/migration only — never
	// self-assignable through public registration.
	Role     string `json:"role" validate:"omitempty,oneof=student employer"`
}

type LoginRequest struct {
	// email or username
	Email    string `json:"email" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}
