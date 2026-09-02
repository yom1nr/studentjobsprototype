package models

import "time"

// AttachmentStudent stores uploaded files for a student.
type AttachmentStudent struct {
	AttachmentStudentID uint   `gorm:"primaryKey;autoIncrement" json:"attachment_student_id"`
	UserID              uint      `gorm:"not null;index" json:"user_id"`
	Profile    string `gorm:"size:500" json:"profile"`    // URL / file path
	Schedule   string `gorm:"size:500" json:"schedule"`
	Transcript string `gorm:"size:500" json:"transcript"`
	Resume     string `gorm:"size:500" json:"resume"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// AttachmentEmployer stores uploaded files for an employer.
type AttachmentEmployer struct {
	AttachmentEmployerID uint   `gorm:"primaryKey;autoIncrement" json:"attachment_employer_id"`
	UserID              uint      `gorm:"not null;index" json:"user_id"`
	Profile       string `gorm:"size:500" json:"profile"`
	CompanyRegis  string `gorm:"size:500" json:"company_regis"`
	Logo          string `gorm:"size:500" json:"logo"`
	CardID        string `gorm:"size:500" json:"card_id"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// Approve tracks employer registration approval by an admin. AdminID is nullable
// because a freshly-submitted employer profile has no reviewer yet (Status stays
// "pending" until an admin acts on it).
type Approve struct {
	ApproveID    uint      `gorm:"primaryKey;autoIncrement" json:"approve_id"`
	UserID       uint      `gorm:"not null;index" json:"user_id"`
	AdminID      *uint     `gorm:"index" json:"admin_id"`
	DateOfSignUp time.Time `json:"date_of_sign_up"`
	Status       string    `gorm:"size:50;not null;default:'pending'" json:"status"` // pending | approved | rejected

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
