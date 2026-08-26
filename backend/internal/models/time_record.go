package models

import (
	"time"
)

// TimeRecord matches the T04_Week06_B6729875 Class Diagram (Analysis level):
// RecordID as its own PK, distinct from Student's PK.
type TimeRecord struct {
	RecordID     uint       `gorm:"primaryKey;autoIncrement" json:"record_id"`
	StudentID    uint       `gorm:"not null;index" json:"student_id"`
	CheckInTime  time.Time  `gorm:"not null" json:"check_in_time"`
	CheckOutTime *time.Time `json:"check_out_time"`
	Latitude     float64    `json:"latitude"`
	Longitude    float64    `json:"longitude"`
	RecordStatus string     `gorm:"size:50;not null;default:'active'" json:"record_status"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	EditRequest *TimeEditRequest `gorm:"foreignKey:RecordID" json:"edit_request,omitempty"`
}

// TimeEditRequest matches the same diagram: RequestID as its own PK, and
// RecordID (not TimeRecordID) as the FK back to TimeRecord.
type TimeEditRequest struct {
	RequestID       uint       `gorm:"primaryKey;autoIncrement" json:"request_id"`
	RecordID        uint       `gorm:"not null;index" json:"record_id"`
	EmployerID      uint       `gorm:"not null;index" json:"employer_id"`
	NewCheckInTime  time.Time  `gorm:"not null" json:"new_check_in_time"`
	NewCheckOutTime *time.Time `json:"new_check_out_time"`
	Reason          string     `gorm:"type:text;not null" json:"reason"`
	RequestStatus   string     `gorm:"size:50;not null;default:'pending'" json:"request_status"` // pending | approved | rejected
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}
