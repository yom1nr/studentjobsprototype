package dto

import "time"

type UserResponse struct {
	ID        uint      `json:"id"`
	UserName  string    `json:"user_name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Gender    string    `json:"gender"`
	Role           string    `json:"role"`
	ProfilePicture string    `json:"profile_picture"`
	CreatedAt      string    `json:"created_at"`
	UpdatedAt string    `json:"updated_at"`
}

type UpdateUserRequest struct {
	UserName        string `json:"user_name" validate:"omitempty,min=2,max=100"`
	Email           string `json:"email" validate:"omitempty,email"`
	CurrentPassword string `json:"current_password" validate:"required_with=Password"`
	Password        string `json:"password" validate:"omitempty,min=8,max=72"`
	Phone           string `json:"phone" validate:"omitempty,max=20"`
	Gender          string `json:"gender" validate:"omitempty,max=20"`
<<<<<<< Updated upstream
	Role            string `json:"role" validate:"omitempty,oneof=student employer admin"`
=======
	ProfilePicture  string `json:"profile_picture" validate:"omitempty"`
	// Role is intentionally NOT editable here — a user must not be able to
	// change their own role via self-service profile update.
>>>>>>> Stashed changes
}

// keep time imported in case other DTOs in this file need it later
var _ = time.Now
