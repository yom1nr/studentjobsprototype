package models

import "gorm.io/gorm"

// Notification is an in-app message sent to a user (e.g. employer-approval
// decisions, interview/agreement updates). CreatedAt from gorm.Model doubles
// as the diagram's CreatedDateTime attribute.
//
// Per the class diagram, a Notification may originate from a RescheduleInterview
// or an EmploymentAgreement. Both FKs are nullable: a notification is always
// addressed to a User, but only some carry a source reference (approval-decision
// notifications, for instance, have neither).
type Notification struct {
	gorm.Model
	UserID                uint  `gorm:"not null;index" json:"user_id"`
	RescheduleInterviewID *uint `gorm:"index" json:"reschedule_interview_id"`
	EmploymentAgreementID *uint `gorm:"index" json:"employment_agreement_id"`
	// Some notifications come straight from an interview (e.g. the student
	// confirming attendance) rather than from a reschedule or an agreement.
	InterviewScheduleID *uint  `gorm:"index" json:"interview_schedule_id"`
	Title               string `gorm:"size:200;not null" json:"title"`
	NotificationType    string `gorm:"size:50;not null" json:"notification_type"`
	Message             string `gorm:"type:text;not null" json:"message"`
	IsRead              bool   `gorm:"not null;default:false" json:"is_read"`
}
