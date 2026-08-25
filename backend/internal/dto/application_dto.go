package dto

// CreateApplicationRequest submits a student's application to a job post.
type CreateApplicationRequest struct {
	JobpostID uint   `json:"jobpost_id" validate:"required"`
	Remarks   string `json:"remarks" validate:"omitempty"`
}

// ApplicationResponse is an application enriched with job-post and student display fields.
type ApplicationResponse struct {
	ID                uint   `json:"id"`
	JobpostID         uint   `json:"jobpost_id"`
	Position          string `json:"position"`
	CompanyName       string `json:"company_name"`
	StudentID         uint   `json:"student_id"`
	StudentName       string `json:"student_name"`
	StudentUniversity string `json:"student_university"`
	StudentPhone      string `json:"student_phone"`
	StudentEmail      string `json:"student_email"`
	Remarks           string `json:"remarks"`
	Status            string `json:"status"`
	ApplyDate         string `json:"apply_date"`
}

// ReviewApplicationRequest is an employer's decision on a student's application.
// ResultStatus "correction_requested" logs feedback without changing Application.Status
// (it stays "pending"); "accepted"/"rejected" also update Application.Status to match.
type ReviewApplicationRequest struct {
	ResultStatus string `json:"result_status" validate:"required,oneof=accepted rejected correction_requested"`
	Comment      string `json:"comment" validate:"omitempty"`
}

// VerifyApplicationRequest is the university admin's final pass/fail decision on
// an application the employer has already accepted.
type VerifyApplicationRequest struct {
	ResultStatus string `json:"result_status" validate:"required,oneof=passed failed"`
	Comment      string `json:"comment" validate:"omitempty"`
}

// AdminApplicationResponse is an employer-accepted application enriched with the
// university admin's own verification status (separate from Application.Status,
// which reflects only the employer's accept/reject decision).
type AdminApplicationResponse struct {
	ID                uint   `json:"id"`
	JobpostID         uint   `json:"jobpost_id"`
	Position          string `json:"position"`
	CompanyName       string `json:"company_name"`
	StudentID         uint   `json:"student_id"`
	StudentName       string `json:"student_name"`
	StudentUniversity string `json:"student_university"`
	Status            string `json:"status"`
	ReviewStatus      string `json:"review_status"` // awaiting | passed | failed
	Comment           string `json:"comment"`
	CheckedAt         string `json:"checked_at"`
}
