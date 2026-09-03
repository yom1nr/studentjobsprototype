package dto

// UpsertJobpostRequest creates or edits a job post owned by the current employer.
type UpsertJobpostRequest struct {
	Position                string  `json:"position" validate:"required,min=1,max=150"`
	JobType                 string  `json:"job_type" validate:"omitempty,max=100"`
	JobDescription          string  `json:"job_description" validate:"omitempty"`
	DateStart               string  `json:"date_start" validate:"omitempty"` // RFC3339, optional (legacy, unused by UI)
	Wage                    float64 `json:"wage" validate:"required,gt=0"`
	Period                  string  `json:"period" validate:"omitempty,max=255"` // working-time schedule (text)
	Location                string  `json:"location" validate:"omitempty,max=255"`
	Welfare                 string  `json:"welfare" validate:"omitempty"`
	Property                string  `json:"property" validate:"omitempty"`                 // main qualifications
	AdditionalQualification string  `json:"additional_qualification" validate:"omitempty"` // extra qualifications
	Quantity                int     `json:"quantity" validate:"omitempty,min=1"`
}

// JobpostResponse is a job listing enriched with the employer's company name for display.
type JobpostResponse struct {
	ID                      uint    `json:"id"`
	EmployerID              uint    `json:"employer_id"`
	CompanyName             string  `json:"company_name"`
	Position                string  `json:"position"`
	JobType                 string  `json:"job_type"`
	JobDescription          string  `json:"job_description"`
	DateStart               *string `json:"date_start"`
	Wage                    float64 `json:"wage"`
	Period                  string  `json:"period"`
	Location                string  `json:"location"`
	Welfare                 string  `json:"welfare"`
	Property                string  `json:"property"`
	AdditionalQualification string  `json:"additional_qualification"`
	Quantity                int     `json:"quantity"`
	Status                  string  `json:"status"`
	CreatedAt               string  `json:"created_at"`
}
