package models

import (
	"time"
)

// User is the base account for all roles in the system.
type User struct {
	UserID   uint   `gorm:"primaryKey;autoIncrement" json:"user_id"`
	UserName string `gorm:"size:100;not null" json:"user_name"`
	Password string `gorm:"size:255;not null" json:"-"`
	Email    string `gorm:"size:150;uniqueIndex;not null" json:"email"`
	Phone    string `gorm:"size:20" json:"phone"`
	Gender   string `gorm:"size:20" json:"gender"`
	Avatar   string `gorm:"type:text" json:"avatar"` // profile-picture URL from POST /upload
	Role     string `gorm:"size:20;not null;default:'student'" json:"role"` // student | employer | admin

	// 1-to-1 Profiles
	Student  *Student  `gorm:"foreignKey:UserID" json:"student,omitempty"`
	Employer *Employer `gorm:"foreignKey:UserID" json:"employer,omitempty"`
	Admin    *Admin    `gorm:"foreignKey:UserID" json:"admin,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// Student profile – linked to a User account (1-to-1).
type Student struct {
	UserID      uint       `gorm:"primaryKey;not null" json:"user_id"`
	User        *User      `gorm:"foreignKey:UserID" json:"-"`
	FirstName   string     `gorm:"size:100;not null" json:"first_name"`
	LastName    string     `gorm:"size:100;not null" json:"last_name"`
	DateOfBirth *time.Time `json:"date_of_birth"`
	Address     string     `gorm:"size:255" json:"address"`
	University  string     `gorm:"size:150" json:"university"`
	Faculty     string     `gorm:"size:150" json:"faculty"`
	Major       string     `gorm:"size:150" json:"major"`
	Years       string     `gorm:"size:10" json:"years"`
	Skill       string     `gorm:"type:text" json:"skill"`
	// AvailableTime is the student's free-time text used by job search (FR5),
	// e.g. "จ-ศ หลัง 16:00, ส-อา ทั้งวัน".
	AvailableTime string    `gorm:"type:text" json:"available_time"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	AttachmentStudent *AttachmentStudent `gorm:"foreignKey:UserID;references:UserID" json:"attachment_student,omitempty"`
}

// Employer profile – linked to a User account (1-to-1).
type Employer struct {
	UserID         uint      `gorm:"primaryKey;not null" json:"user_id"`
	User           *User     `gorm:"foreignKey:UserID" json:"-"`
	FirstName      string    `gorm:"size:100;not null" json:"first_name"`
	LastName       string    `gorm:"size:100;not null" json:"last_name"`
	Position       string    `gorm:"size:100" json:"position"`
	LineID         string    `gorm:"size:100" json:"line_id"`
	CompanyName    string    `gorm:"size:150;not null" json:"company_name"`
	BusinessType   string    `gorm:"size:100" json:"business_type"`
	TaxID          string    `gorm:"size:50;uniqueIndex" json:"tax_id"`
	Link           string    `gorm:"size:255" json:"link"`
	CompanyAddress string    `gorm:"type:text" json:"company_address"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Approve            *Approve            `gorm:"foreignKey:UserID;references:UserID" json:"approve,omitempty"`
	AttachmentEmployer *AttachmentEmployer `gorm:"foreignKey:UserID;references:UserID" json:"attachment_employer,omitempty"`
}

// Admin profile – linked to a User account (1-to-1).
type Admin struct {
	UserID     uint      `gorm:"primaryKey;not null" json:"user_id"`
	User       *User     `gorm:"foreignKey:UserID" json:"-"`
	FirstName  string    `gorm:"size:100;not null" json:"first_name"`
	LastName   string    `gorm:"size:100;not null" json:"last_name"`
	Position   string    `gorm:"size:100" json:"position"`
	Enterprise string    `gorm:"size:150" json:"enterprise"`
	Department string    `gorm:"size:150" json:"department"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}
