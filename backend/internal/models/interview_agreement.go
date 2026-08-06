package models

import (
	"time"

	"gorm.io/gorm"
)

// InterviewSchedule represents an interview appointment between a Student and an Employer.
type InterviewSchedule struct {
	gorm.Model
	StudentID          uint      `gorm:"not null;index" json:"student_id"`
	EmployerID         uint      `gorm:"not null;index" json:"employer_id"`
	InterviewFormat    string    `gorm:"size:100" json:"interview_format"` // online | onsite
	AppointmentTime    string    `gorm:"size:20" json:"appointment_time"`  // e.g. "10:30"
	AppointmentDate    *time.Time `json:"appointment_date"`
	PreparationDetails string    `gorm:"type:text" json:"preparation_details"`

	// Relations
	Reschedules []RescheduleInterview `gorm:"foreignKey:InterviewScheduleID" json:"reschedules,omitempty"`
}

// RescheduleInterview records a request to change an interview time.
type RescheduleInterview struct {
	gorm.Model
	InterviewScheduleID    uint      `gorm:"not null;index" json:"interview_schedule_id"`
	StudentAvailableDateTime *time.Time `json:"student_available_date_time"`
	NewAppointmentDateTime   *time.Time `json:"new_appointment_date_time"`
	RescheduleReason         string    `gorm:"type:text" json:"reschedule_reason"`
}

// EmploymentAgreement is the contract between a Student and an Employer.
type EmploymentAgreement struct {
	gorm.Model
	StudentID       uint    `gorm:"not null;index" json:"student_id"`
	EmployerID      uint    `gorm:"not null;index" json:"employer_id"`
	StartDate       *time.Time `json:"start_date"`
	WageRate        float64 `gorm:"type:decimal(10,2)" json:"wage_rate"`
	DurationMonths  int     `gorm:"default:0" json:"duration_months"`
	WorkingHours    string  `gorm:"size:100" json:"working_hours"`
	LeavePolicy     string  `gorm:"type:text" json:"leave_policy"`
	AdditionalTerms string  `gorm:"type:text" json:"additional_terms"`

	// Relations
	Payrolls []Payroll `gorm:"foreignKey:EmploymentAgreementID" json:"payrolls,omitempty"`
}
