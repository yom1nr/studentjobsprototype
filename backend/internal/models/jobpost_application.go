package models

import (
	"time"

	"gorm.io/gorm"
)

// Jobpost is a job listing created by an Employer. Period is free text (e.g.
// "3 เดือน") per the actual create/edit design, not a date — the class
// diagram typed it as dateTime, but the UI never shows a date picker for it.
type Jobpost struct {
	gorm.Model
	EmployerID      uint      `gorm:"not null;index" json:"employer_id"`
	Position        string    `gorm:"size:150;not null" json:"position"`
	JobType         string    `gorm:"size:100" json:"job_type"`
	JobDescription  string    `gorm:"type:text" json:"job_description"`
	DateStart       *time.Time `json:"date_start"`
	Wage            float64   `gorm:"type:decimal(10,2)" json:"wage"`
	Period          string    `gorm:"size:100" json:"period"`
	Location        string    `gorm:"size:255" json:"location"`
	Welfare         string    `gorm:"type:text" json:"welfare"`
	Property        string    `gorm:"size:255" json:"property"`
	Quantity        int       `gorm:"default:1" json:"quantity"`
	Status          string    `gorm:"size:50;not null;default:'open'" json:"status"` // open | closed | draft

	// Relations
	Applications []Application `gorm:"foreignKey:JobpostID" json:"applications,omitempty"`
}

// Application is a student's job application for a Jobpost.
type Application struct {
	gorm.Model
	StudentID  uint      `gorm:"not null;index" json:"student_id"`
	JobpostID  uint      `gorm:"not null;index" json:"jobpost_id"`
	ApplyDate  *time.Time `json:"apply_date"`
	Remarks    string    `gorm:"type:text" json:"remarks"`
	Status     string    `gorm:"size:50;not null;default:'pending'" json:"status"` // pending | accepted | rejected

	// Belongs-to
	Jobpost Jobpost `gorm:"foreignKey:JobpostID" json:"jobpost,omitempty"`

	// Relations
	Audits []ApplicationAudit `gorm:"foreignKey:ApplicationID" json:"audits,omitempty"`
}

// ApplicationAudit records each review/audit action on an Application.
type ApplicationAudit struct {
	gorm.Model
	ApplicationID uint      `gorm:"not null;index" json:"application_id"`
	AdminID       *uint     `gorm:"index" json:"admin_id"`
	ResultStatus  string    `gorm:"size:50;not null" json:"result_status"`
	Comment       string    `gorm:"type:text" json:"comment"`
	CheckedAt     time.Time `gorm:"not null" json:"checked_at"`
}
