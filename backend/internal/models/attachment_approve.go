package models

import "gorm.io/gorm"

// AttachmentStudent stores uploaded files for a student.
type AttachmentStudent struct {
	gorm.Model
	StudentID  uint   `gorm:"not null;index" json:"student_id"`
	Profile    string `gorm:"size:500" json:"profile"`    // URL / file path
	Schedule   string `gorm:"size:500" json:"schedule"`
	Transcript string `gorm:"size:500" json:"transcript"`
	Resume     string `gorm:"size:500" json:"resume"`
}

// AttachmentEmployer stores uploaded files for an employer.
type AttachmentEmployer struct {
	gorm.Model
	EmployerID    uint   `gorm:"not null;index" json:"employer_id"`
	Profile       string `gorm:"size:500" json:"profile"`
	CompanyRegis  string `gorm:"size:500" json:"company_regis"`
	Logo          string `gorm:"size:500" json:"logo"`
	CardID        string `gorm:"size:500" json:"card_id"`
}

// Approve tracks employer registration approval by an admin. AdminID is nullable
// because a freshly-submitted employer profile has no reviewer yet (Status stays
// "pending" until an admin acts on it).
type Approve struct {
	gorm.Model
	EmployerID   uint   `gorm:"not null;index" json:"employer_id"`
	AdminID      *uint  `gorm:"index" json:"admin_id"`
	DateOfSignUp string `gorm:"size:30" json:"date_of_sign_up"`
	Status       string `gorm:"size:50;not null;default:'pending'" json:"status"` // pending | approved | rejected

	// Belongs-to
	Admin *Admin `gorm:"foreignKey:AdminID" json:"admin,omitempty"`
}
