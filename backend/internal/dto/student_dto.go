package dto

// StudentProfileRequest submits/updates the current student's profile. Phone,
// gender and avatar live on the User account but are accepted here so the
// student settings page can save everything in one call.
type StudentProfileRequest struct {
    FirstName     string `json:"first_name" validate:"required,min=1,max=100"`
    LastName      string `json:"last_name" validate:"required,min=1,max=100"`
    DateOfBirth   string `json:"date_of_birth" validate:"omitempty,datetime=2006-01-02"`
    Gender        string `json:"gender" validate:"omitempty,max=20"`
    Phone         string `json:"phone" validate:"omitempty,max=20"`
    Address       string `json:"address" validate:"omitempty,max=255"`
    University    string `json:"university" validate:"omitempty,max=150"`
    Faculty       string `json:"faculty" validate:"omitempty,max=150"`
    Major         string `json:"major" validate:"omitempty,max=150"`
    Years         string `json:"years" validate:"omitempty,max=10"`
    Skill         string `json:"skill" validate:"omitempty"`
    AvailableTime string `json:"available_time" validate:"omitempty"`
    Avatar        string `json:"avatar" validate:"omitempty,max=500"`
    // Supporting-document URLs (from POST /upload), collected at registration.
    Transcript string `json:"transcript" validate:"omitempty,max=500"`
    Resume     string `json:"resume" validate:"omitempty,max=500"`
    Schedule   string `json:"schedule" validate:"omitempty,max=500"`
}

type StudentProfileResponse struct {
    ID            uint   `json:"id"`
    UserID        uint   `json:"user_id"`
    FirstName     string `json:"first_name"`
    LastName      string `json:"last_name"`
    DateOfBirth   string `json:"date_of_birth"` // YYYY-MM-DD, "" when unset
    Age           int    `json:"age"`           // derived from DateOfBirth
    Gender        string `json:"gender"`
    Phone         string `json:"phone"`
    Address       string `json:"address"`
    University    string `json:"university"`
    Faculty       string `json:"faculty"`
    Major         string `json:"major"`
    Years         string `json:"years"`
    Skill         string `json:"skill"`
    AvailableTime string `json:"available_time"`
    Avatar        string `json:"avatar"`
    Transcript    string `json:"transcript"`
    Resume        string `json:"resume"`
    Schedule      string `json:"schedule"`
    CreatedAt     string `json:"created_at"`
    UpdatedAt     string `json:"updated_at"`
}
