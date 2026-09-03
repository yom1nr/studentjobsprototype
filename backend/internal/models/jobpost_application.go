package models

import (
	"time"
)

// Jobpost is a job listing created by an Employer. Period is the working-time
// schedule as free text (e.g. "จันทร์-ศุกร์ 17:00-23:00") — the create/edit form
// shows a plain text field, and the FR5 job-search filter keyword-matches it.
// DateStart is kept for backwards compatibility but is no longer shown in the UI.
type Jobpost struct {
	JobpostID      uint       `gorm:"primaryKey;autoIncrement" json:"jobpost_id"`
	UserID         uint       `gorm:"not null;index" json:"user_id"`
	JobID          string     `gorm:"size:150;not null" json:"job_id"`
	Position       string     `gorm:"size:150;not null" json:"position"`
	JobType        string     `gorm:"size:100" json:"job_type"`
	JobDescription string     `gorm:"type:text" json:"job_description"`
	DateStart      *time.Time `json:"date_start"`
	Wage           float64    `gorm:"type:decimal(10,2)" json:"wage"`
	Period         string     `gorm:"size:255" json:"period"` // working-time schedule (text)
	Location       string     `gorm:"size:255" json:"location"`
	Welfare        string     `gorm:"type:text" json:"welfare"`
	Property       string     `gorm:"type:text" json:"property"` // main qualifications, one per line

	// AdditionalQualification is the "คุณสมบัติเพิ่มเติม" section shown to
	// students, one item per line. Optional.
	AdditionalQualification string `gorm:"type:text" json:"additional_qualification"`

	Quantity int    `gorm:"default:1" json:"quantity"`
	Status   string `gorm:"size:50;not null;default:'open'" json:"status"` // open | closed | draft

	// Relations. User is left to convention for the same reason as Application.Jobpost
	// below — User's primary key is also named UserID, so naming the foreign key here
	// would make GORM read this as a has-one and join on the wrong column.
	User         *User         `json:"user,omitempty"`
	Applications []Application `gorm:"foreignKey:JobpostID" json:"applications,omitempty"`
	CreatedAt    time.Time     `gorm:"autoCreateTime" json:"created_at"`
}

// Application is a student's job application for a Jobpost.
type Application struct {
	ApplicationID uint       `gorm:"primaryKey" json:"application_id"`
	StudentID     uint       `gorm:"not null;index" json:"student_id"`
	JobpostID     uint       `gorm:"not null;index" json:"jobpost_id"`
	ApplyDate     *time.Time `json:"apply_date"`
	Remarks       string     `gorm:"type:text" json:"remarks"`
	Status        string     `gorm:"size:50;not null;default:'pending'" json:"status"` // pending | correction_requested | accepted | rejected

	// Belongs-to. The foreign key is left to GORM's convention (Application.JobpostID
	// -> Jobpost's primary key). Spelling it as `foreignKey:JobpostID` is ambiguous
	// here because Jobpost's own primary key is also named JobpostID: GORM then reads
	// it as a has-one and joins jobposts.jobpost_id to applications.application_id,
	// which silently loads a different position's job post.
	Jobpost Jobpost `json:"jobpost,omitempty"`

	// Relations
	Audits    []ApplicationAudit    `gorm:"foreignKey:ApplicationID" json:"audits,omitempty"`
	Documents []ApplicationDocument `gorm:"foreignKey:ApplicationID" json:"documents,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// ApplicationDocument is a supporting file a student attaches to a job
// application (ID card, house registration, ...) — usually in response to an
// employer's "correction_requested" review. URL comes from POST /api/v1/upload.
type ApplicationDocument struct {
	ApplicationDocumentID uint      `gorm:"primaryKey;autoIncrement" json:"application_document_id"`
	ApplicationID         uint      `gorm:"not null;index" json:"application_id"`
	Name                  string    `gorm:"size:255;not null" json:"name"`
	URL                   string    `gorm:"size:500;not null" json:"url"`
	CreatedAt             time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// ApplicationAudit records each review/audit action on an Application.
type ApplicationAudit struct {
	ApplicationAuditID uint      `gorm:"primaryKey" json:"application_audit_id"`
	ApplicationID      uint      `gorm:"not null;index" json:"application_id"`
	AdminID            *uint     `gorm:"index" json:"admin_id"`
	ResultStatus       string    `gorm:"size:50;not null" json:"result_status"`
	Comment            string    `gorm:"type:text" json:"comment"`
	CheckedAt          time.Time `gorm:"not null" json:"checked_at"`
}
