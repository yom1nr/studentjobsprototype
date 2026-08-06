package models

import (
	"time"

	"gorm.io/gorm"
)

type TimeRecord struct {
	gorm.Model
	StudentID    uint       `gorm:"not null;index" json:"student_id"`
	CheckInTime  time.Time  `gorm:"not null" json:"check_in_time"`
	CheckOutTime *time.Time `json:"check_out_time"`
	Latitude     float64    `json:"latitude"`
	Longitude    float64    `json:"longitude"`
	RecordStatus string     `gorm:"size:50;not null;default:'active'" json:"record_status"`

	// Relations
	EditRequest *TimeEditRequest `gorm:"foreignKey:TimeRecordID" json:"edit_request,omitempty"`
}

type TimeEditRequest struct {
	gorm.Model
	TimeRecordID    uint       `gorm:"not null;index" json:"time_record_id"`
	EmployerID      uint       `gorm:"not null;index" json:"employer_id"`
	NewCheckInTime  time.Time  `gorm:"not null" json:"new_check_in_time"`
	NewCheckOutTime *time.Time `json:"new_check_out_time"`
	Reason          string     `gorm:"type:text;not null" json:"reason"`
	RequestStatus   string     `gorm:"size:50;not null;default:'pending'" json:"request_status"` // pending | approved | rejected
}