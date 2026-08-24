package dto

// CreateComplaintRequest submits a new complaint.
type CreateComplaintRequest struct {
	Title         string `json:"title" validate:"required,min=1,max=255"`
	Description   string `json:"description" validate:"required"`
	ReferenceType string `json:"reference_type" validate:"omitempty"`
}

// AddComplaintAttachmentRequest records an uploaded file's metadata (no backend
// file storage exists in this app — same UI-only-upload convention used
// elsewhere, e.g. employer/student document uploads).
type AddComplaintAttachmentRequest struct {
	FileName string `json:"file_name" validate:"required"`
	FileType string `json:"file_type" validate:"omitempty"`
	FileSize int64  `json:"file_size" validate:"omitempty"`
}

// AddComplaintHistoryRequest lets an admin move a complaint's status forward.
type AddComplaintHistoryRequest struct {
	Status string `json:"status" validate:"required,oneof=submitted in_review resolved"`
	Note   string `json:"note" validate:"omitempty"`
}

// ComplaintAttachmentResponse is one uploaded file's metadata.
type ComplaintAttachmentResponse struct {
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
}

// ComplaintHistoryResponse is one status-change entry.
type ComplaintHistoryResponse struct {
	ID           uint   `json:"id"`
	Status       string `json:"status"`
	ActionByRole string `json:"action_by_role"`
	Note         string `json:"note"`
	Timestamp    string `json:"timestamp"`
}

// ComplaintResponse is a complaint enriched with submitter display fields.
type ComplaintResponse struct {
	ID               uint                          `json:"id"`
	Title            string                        `json:"title"`
	Description      string                        `json:"description"`
	ReferenceType    string                        `json:"reference_type"`
	Status           string                        `json:"status"`
	ResolutionDetail string                        `json:"resolution_detail"`
	CreatedAt        string                        `json:"created_at"`
	UpdatedAt        string                        `json:"updated_at"`
	SubmitterName    string                        `json:"submitter_name"`
	SubmitterRole    string                        `json:"submitter_role"`
	Histories        []ComplaintHistoryResponse    `json:"histories"`
	Attachments      []ComplaintAttachmentResponse `json:"attachments"`
}
