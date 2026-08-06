package models

import (
	"time"

	"gorm.io/gorm"
)

// User is the base account for all roles in the system.
type User struct {
	gorm.Model
	UserName string  `gorm:"size:100;not null" json:"user_name"`
	Password string  `gorm:"size:255;not null" json:"-"`
	Email    string  `gorm:"size:150;uniqueIndex;not null" json:"email"`
	Phone    string  `gorm:"size:20" json:"phone"`
	Gender   string  `gorm:"size:20" json:"gender"`
	Role     string  `gorm:"size:20;not null;default:'student'" json:"role"` // student | employer | admin

	// Reverse relations (optional eager-load)
	Student  *Student  `gorm:"foreignKey:UserID" json:"student,omitempty"`
	Employer *Employer `gorm:"foreignKey:UserID" json:"employer,omitempty"`
	Admin    *Admin    `gorm:"foreignKey:UserID" json:"admin,omitempty"`

	Complaints []Complaint `gorm:"foreignKey:UserID" json:"complaints,omitempty"`
}

// Student profile – linked to a User account (1-to-1).
type Student struct {
	gorm.Model
	UserID      uint      `gorm:"not null;uniqueIndex" json:"user_id"`
	FirstName   string    `gorm:"size:100;not null" json:"first_name"`
	LastName    string    `gorm:"size:100;not null" json:"last_name"`
	DateOfBirth *time.Time `json:"date_of_birth"`
	Address     string    `gorm:"size:255" json:"address"`
	University  string    `gorm:"size:150" json:"university"`
	Faculty     string    `gorm:"size:150" json:"faculty"`
	Major       string    `gorm:"size:150" json:"major"`
	Years       string    `gorm:"size:10" json:"years"`
	Skill       string    `gorm:"type:text" json:"skill"`

	// Relations
	Attachments         []AttachmentStudent  `gorm:"foreignKey:StudentID" json:"attachments,omitempty"`
	Applications        []Application        `gorm:"foreignKey:StudentID" json:"applications,omitempty"`
	InterviewSchedules  []InterviewSchedule  `gorm:"foreignKey:StudentID" json:"interview_schedules,omitempty"`
	EmploymentAgreements []EmploymentAgreement `gorm:"foreignKey:StudentID" json:"employment_agreements,omitempty"`
	TimeRecords         []TimeRecord         `gorm:"foreignKey:StudentID" json:"time_records,omitempty"`
}

// Employer profile – linked to a User account (1-to-1).
type Employer struct {
	gorm.Model
	UserID         uint   `gorm:"not null;uniqueIndex" json:"user_id"`
	FirstName      string `gorm:"size:100;not null" json:"first_name"`
	LastName       string `gorm:"size:100;not null" json:"last_name"`
	Position       string `gorm:"size:100" json:"position"`
	LineID         string `gorm:"size:100" json:"line_id"`
	CompanyName    string `gorm:"size:150;not null" json:"company_name"`
	BusinessType   string `gorm:"size:100" json:"business_type"`
	TaxID          string `gorm:"size:50;uniqueIndex" json:"tax_id"`
	Link           string `gorm:"size:255" json:"link"`
	CompanyAddress string `gorm:"type:text" json:"company_address"`

	// Relations
	Attachment          *AttachmentEmployer   `gorm:"foreignKey:EmployerID" json:"attachment,omitempty"`
	Approve             *Approve              `gorm:"foreignKey:EmployerID" json:"approve,omitempty"`
	Jobposts            []Jobpost             `gorm:"foreignKey:EmployerID" json:"jobposts,omitempty"`
	InterviewSchedules  []InterviewSchedule   `gorm:"foreignKey:EmployerID" json:"interview_schedules,omitempty"`
	EmploymentAgreements []EmploymentAgreement `gorm:"foreignKey:EmployerID" json:"employment_agreements,omitempty"`
	TimeEditRequests    []TimeEditRequest     `gorm:"foreignKey:EmployerID" json:"time_edit_requests,omitempty"`
	Payrolls            []Payroll             `gorm:"foreignKey:EmployerID" json:"payrolls,omitempty"`
}

// Admin profile – linked to a User account (1-to-1).
type Admin struct {
	gorm.Model
	UserID     uint   `gorm:"not null;uniqueIndex" json:"user_id"`
	FirstName  string `gorm:"size:100;not null" json:"first_name"`
	LastName   string `gorm:"size:100;not null" json:"last_name"`
	Position   string `gorm:"size:100" json:"position"`
	Enterprise string `gorm:"size:150" json:"enterprise"`
	Department string `gorm:"size:150" json:"department"`

	// Relations
	Approves          []Approve          `gorm:"foreignKey:AdminID" json:"approves,omitempty"`
	ApplicationAudits []ApplicationAudit `gorm:"foreignKey:AdminID" json:"application_audits,omitempty"`
}
