package dto

// CreateApplicationRequest submits a student's application to a job post.
type CreateApplicationRequest struct {
	JobpostID uint   `json:"jobpost_id" validate:"required"`
	Remarks   string `json:"remarks" validate:"omitempty"`
}

// ApplicationDocumentInput is one supporting file (URL from POST /upload) the
// student attaches when updating an application.
type ApplicationDocumentInput struct {
	Name string `json:"name" validate:"required,max=255"`
	URL  string `json:"url" validate:"required,max=500"`
}

// UpdateApplicationRequest lets a student revise a still-open application
// (status pending or correction_requested) — edit the note and replace the
// attached documents. Sending it moves the application back to "pending".
type UpdateApplicationRequest struct {
	Remarks   string                     `json:"remarks" validate:"omitempty"`
	Documents []ApplicationDocumentInput `json:"documents" validate:"omitempty,dive"`
}

// ApplicationDocumentResponse is one attached file on an application.
type ApplicationDocumentResponse struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// ApplicationAuditEntry is one review/resubmit event in an application's history.
type ApplicationAuditEntry struct {
	ResultStatus string `json:"result_status"` // accepted | rejected | correction_requested | resubmitted | passed | failed
	Comment      string `json:"comment"`
	CheckedAt    string `json:"checked_at"`
	ByAdmin      bool   `json:"by_admin"`
}

// ApplicationResponse is an application enriched with job-post and student display fields.
type ApplicationResponse struct {
	ID                uint                          `json:"id"`
	JobpostID         uint                          `json:"jobpost_id"`
	Position          string                        `json:"position"`
	CompanyName       string                        `json:"company_name"`
	StudentID         uint                          `json:"student_id"`
	StudentName       string                        `json:"student_name"`
	StudentUniversity string                        `json:"student_university"`
	StudentPhone      string                        `json:"student_phone"`
	StudentEmail      string                        `json:"student_email"`
	Remarks           string                        `json:"remarks"`
	Status            string                        `json:"status"`
	ApplyDate         string                        `json:"apply_date"`
	Documents         []ApplicationDocumentResponse `json:"documents"`
	Audits            []ApplicationAuditEntry       `json:"audits"`
}

// ReviewApplicationRequest is an employer's decision on a student's application.
// ResultStatus is written to Application.Status directly: "correction_requested"
// re-opens it for the student to revise (they resubmit -> back to "pending"),
// "accepted"/"rejected" are terminal.
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
