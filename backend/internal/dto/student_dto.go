package dto

// StudentProfileRequest submits/updates the current student's profile.
type StudentProfileRequest struct {
	FirstName   string `json:"first_name" validate:"required,min=1,max=100"`
	LastName    string `json:"last_name" validate:"required,min=1,max=100"`
	DateOfBirth string `json:"date_of_birth" validate:"omitempty"`
	Address     string `json:"address" validate:"omitempty,max=255"`
	University string `json:"university" validate:"omitempty,max=150"`
	Faculty    string `json:"faculty" validate:"omitempty,max=150"`
	Major      string `json:"major" validate:"omitempty,max=150"`
	Years          string `json:"years" validate:"omitempty,max=10"`
	Skill          string `json:"skill" validate:"omitempty"`
	ProfilePicture string `json:"profile_picture" validate:"omitempty"`
	Schedule       string `json:"schedule" validate:"omitempty,max=500"`
	Transcript     string `json:"transcript" validate:"omitempty,max=500"`
	Resume         string `json:"resume" validate:"omitempty,max=500"`
}

type StudentProfileResponse struct {
	ID          uint   `json:"id"`
	UserID      uint   `json:"user_id"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"`
	Address     string `json:"address"`
	University  string `json:"university"`
	Faculty    string `json:"faculty"`
	Major      string `json:"major"`
	Years      string `json:"years"`
	Skill      string `json:"skill"`
	Schedule   string `json:"schedule"`
	Transcript string `json:"transcript"`
	Resume     string `json:"resume"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}
