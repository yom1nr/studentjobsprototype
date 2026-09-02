package dto

// EmployerProfileRequest submits/updates the current employer's company profile.
type EmployerProfileRequest struct {
    FirstName      string `json:"first_name" validate:"required,min=1,max=100"`
    LastName       string `json:"last_name" validate:"required,min=1,max=100"`
    Position       string `json:"position" validate:"omitempty,max=100"`
    LineID         string `json:"line_id" validate:"omitempty,max=100"`
    CompanyName    string `json:"company_name" validate:"required,min=1,max=150"`
    BusinessType   string `json:"business_type" validate:"omitempty,max=100"`
    TaxID          string `json:"tax_id" validate:"required,max=50"`
    Link           string `json:"link" validate:"omitempty,max=255"`
    CompanyAddress string `json:"company_address" validate:"omitempty"`
    CompanyRegis   string `json:"company_regis" validate:"omitempty,max=500"`
    Logo           string `json:"logo" validate:"omitempty,max=500"`
    CardID         string `json:"card_id" validate:"omitempty,max=500"`
    ProfilePicture string `json:"profile_picture" validate:"omitempty,max=500"`
}

type EmployerProfileResponse struct {
    ID             uint   `json:"id"`
    UserID         uint   `json:"user_id"`
    FirstName      string `json:"first_name"`
    LastName       string `json:"last_name"`
    Position       string `json:"position"`
    LineID         string `json:"line_id"`
    CompanyName    string `json:"company_name"`
    BusinessType   string `json:"business_type"`
    TaxID          string `json:"tax_id"`
    Link           string `json:"link"`
    CompanyAddress string `json:"company_address"`
    CompanyRegis   string `json:"company_regis"`
    Logo           string `json:"logo"`
    CardID         string `json:"card_id"`
    ApproveStatus  string `json:"approve_status"`
    CreatedAt      string `json:"created_at"`
    UpdatedAt      string `json:"updated_at"`
}
