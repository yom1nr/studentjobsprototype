package dto

// CreateAgreementRequest drafts and sends an employment agreement to a student
// who passed the interview.
type CreateAgreementRequest struct {
	// InterviewID says which passed interview this contract comes out of, and the
	// student and position follow from it. Keying on the interview rather than the
	// student lets someone who passed for two positions be hired for both — a
	// student-level key would allow only one contract per person, ever.
	InterviewID     uint    `json:"interview_id" validate:"required"`
	StartDate       string  `json:"start_date" validate:"required"` // "2026-08-01"
	WageRate        float64 `json:"wage_rate" validate:"required,gt=0"`
	DurationMonths  int     `json:"duration_months" validate:"required,gt=0"`
	WorkingHours    string  `json:"working_hours" validate:"required"`
	LeavePolicy     string  `json:"leave_policy" validate:"omitempty"`
	AdditionalTerms string  `json:"additional_terms" validate:"omitempty"`
}

// RejectAgreementRequest is the student's reason for declining an agreement.
type RejectAgreementRequest struct {
	Reason string `json:"reason" validate:"required"`
}

// AgreementResponse is an employment agreement enriched with display fields.
type AgreementResponse struct {
	ID uint `json:"id"`
	// Which interview this contract came out of, so callers can tell which
	// passed interviews have already been turned into a hire.
	InterviewScheduleID *uint   `json:"interview_schedule_id"`
	StudentID           uint    `json:"student_id"`
	StudentName         string  `json:"student_name"`
	EmployerID          uint    `json:"employer_id"`
	CompanyName         string  `json:"company_name"`
	StartDate           string  `json:"start_date"`
	WageRate            float64 `json:"wage_rate"`
	DurationMonths      int     `json:"duration_months"`
	WorkingHours        string  `json:"working_hours"`
	LeavePolicy         string  `json:"leave_policy"`
	AdditionalTerms     string  `json:"additional_terms"`
	Status              string  `json:"status"`
	RejectReason        string  `json:"reject_reason"`
	CreatedAt           string  `json:"created_at"`
}
