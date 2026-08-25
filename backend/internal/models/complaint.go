package models

import (
	"time"

	"gorm.io/gorm"
)

// Complaint is a report submitted by any User.
type Complaint struct {
	ComplaintID      uint      `gorm:"primaryKey" json:"complaint_id"`
	UserID           uint      `gorm:"not null;index" json:"user_id"`
	Title            string    `gorm:"size:255;not null" json:"title"`
	Description      string    `gorm:"type:text" json:"description"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	ReferenceType    string    `gorm:"size:100" json:"reference_type"` // e.g. "jobpost", "employer"
	ReferenceID      string    `gorm:"size:100" json:"reference_id"`
	ResolutionDetail string    `gorm:"type:text" json:"resolution_detail"`

	// Relations
	Histories   []ComplaintHistory `gorm:"foreignKey:ComplaintID" json:"histories,omitempty"`
	Attachments []Attachment       `gorm:"foreignKey:ComplaintID" json:"attachments,omitempty"`
}

// ComplaintHistory tracks every status change on a Complaint.
type ComplaintHistory struct {
	ComplaintHistoryID uint      `gorm:"primaryKey" json:"complaint_history_id"`
	ComplaintID        uint      `gorm:"not null;index" json:"complaint_id"`
	Status             string    `gorm:"size:50;not null" json:"status"`
	ActionByRole       string    `gorm:"size:50" json:"action_by_role"` // student | employer | admin
	Note               string    `gorm:"type:text" json:"note"`
	Timestamp          time.Time `gorm:"not null" json:"timestamp"`
}

// Attachment is a file uploaded in support of a Complaint.
type Attachment struct {
	AttachmentID uint   `gorm:"primaryKey" json:"attachment_id"`
	ComplaintID uint   `gorm:"not null;index" json:"complaint_id"`
	FileName    string `gorm:"size:255;not null" json:"file_name"`
	FileType    string `gorm:"size:100" json:"file_type"`
	FileSize    int64  `json:"file_size"`
	FileUrl     string `gorm:"size:500" json:"file_url"`
}
