package dto

// StudentProfileRequest submits/updates the current student's profile.
type StudentProfileRequest struct {
	FirstName  string `json:"first_name" validate:"required,min=1,max=100"`
	LastName   string `json:"last_name" validate:"required,min=1,max=100"`
	Address    string `json:"address" validate:"omitempty,max=255"`
	University string `json:"university" validate:"omitempty,max=150"`
	Faculty    string `json:"faculty" validate:"omitempty,max=150"`
	Major      string `json:"major" validate:"omitempty,max=150"`
	Years      string `json:"years" validate:"omitempty,max=10"`
	Skill      string `json:"skill" validate:"omitempty"`
}

type StudentProfileResponse struct {
	ID         uint   `json:"id"`
	UserID     uint   `json:"user_id"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Address    string `json:"address"`
	University string `json:"university"`
	Faculty    string `json:"faculty"`
	Major      string `json:"major"`
	Years      string `json:"years"`
	Skill      string `json:"skill"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}
