package models

import (
	"time"

	"gorm.io/gorm"
)

// InterviewSchedule represents an interview appointment between a Student and an Employer.
// Location isn't a literal diagram attribute (same pragmatic addition as
// EmploymentAgreement.Status above) — it stores the onsite address or the
// online meeting link shown in the "สถานที่ / ลิงก์สัมภาษณ์" design field.
type InterviewSchedule struct {
	gorm.Model
	StudentID          uint       `gorm:"not null;index" json:"student_id"`
	EmployerID         uint       `gorm:"not null;index" json:"employer_id"`
	InterviewFormat    string     `gorm:"size:100" json:"interview_format"` // online | onsite
	AppointmentTime    string     `gorm:"size:20" json:"appointment_time"`  // e.g. "10:30"
	AppointmentDate    *time.Time `json:"appointment_date"`
	Location           string     `gorm:"size:500" json:"location"`
	PreparationDetails string     `gorm:"type:text" json:"preparation_details"`

	// Status tracks where the appointment stands so the UI can render its badge
	// ("รอการยืนยัน" / "สัมภาษณ์แล้ว" / "ยกเลิกนัด"). Previously ConfirmAttendance
	// only fired a notification, so nothing could be queried back.
	// pending | confirmed | rescheduling | completed | cancelled
	Status      string     `gorm:"size:50;not null;default:'pending'" json:"status"`
	ConfirmedAt *time.Time `json:"confirmed_at"`

	// Result persists the interview outcome. It used to live only inside a
	// notification message, which meant a student could not re-open the result
	// page and an employer could not tell whether a result had been sent yet.
	// empty = not announced, passed | failed
	Result            string     `gorm:"size:20" json:"result"`
	ResultComment     string     `gorm:"type:text" json:"result_comment"`
	ResultAnnouncedAt *time.Time `json:"result_announced_at"`

	// Relations
	Reschedules   []RescheduleInterview `gorm:"foreignKey:InterviewScheduleID" json:"reschedules,omitempty"`
	Documents     []Document            `gorm:"foreignKey:InterviewScheduleID" json:"documents,omitempty"`
	Agreement     *EmploymentAgreement  `gorm:"foreignKey:InterviewScheduleID" json:"agreement,omitempty"`
	Notifications []Notification        `gorm:"foreignKey:InterviewScheduleID" json:"notifications,omitempty"`
}

// RescheduleInterview records a request to change an interview time.
type RescheduleInterview struct {
	gorm.Model
	InterviewScheduleID      uint       `gorm:"not null;index" json:"interview_schedule_id"`
	StudentAvailableDateTime *time.Time `json:"student_available_date_time"`
	NewAppointmentDateTime   *time.Time `json:"new_appointment_date_time"`
	RescheduleReason         string     `gorm:"type:text" json:"reschedule_reason"`

	// RequestedBy distinguishes the two flows that share this table: the student
	// proposing their free slots, and the employer asking the student for theirs.
	// student | employer
	RequestedBy string `gorm:"size:20;not null;default:'student'" json:"requested_by"`

	// Status of the request itself. pending | accepted | rejected
	Status string `gorm:"size:50;not null;default:'pending'" json:"status"`

	// Relations
	Notifications []Notification `gorm:"foreignKey:RescheduleInterviewID" json:"notifications,omitempty"`
}

// EmploymentAgreement is the contract between a Student and an Employer.
// Status isn't a literal diagram attribute, but is needed to persist the
// accept/reject decision — same pragmatic addition as Application.Status and
// Jobpost.Status elsewhere in this codebase (see t04_project_docs_reference).
type EmploymentAgreement struct {
	gorm.Model
	StudentID           uint       `gorm:"not null;index" json:"student_id"`
	EmployerID          uint       `gorm:"not null;index" json:"employer_id"`
	InterviewScheduleID *uint      `gorm:"index" json:"interview_schedule_id"` // interview this agreement stemmed from (per class diagram)
	StartDate           *time.Time `json:"start_date"`
	WageRate            float64    `gorm:"type:decimal(10,2)" json:"wage_rate"`
	DurationMonths      int        `gorm:"default:0" json:"duration_months"`
	WorkingHours        string     `gorm:"size:100" json:"working_hours"`
	LeavePolicy         string     `gorm:"type:text" json:"leave_policy"`
	AdditionalTerms     string     `gorm:"type:text" json:"additional_terms"`
	Status              string     `gorm:"size:50;not null;default:'pending'" json:"status"` // pending | accepted | rejected
	RejectReason        string     `gorm:"type:text" json:"reject_reason"`

	// Belongs-to
	InterviewSchedule *InterviewSchedule `gorm:"foreignKey:InterviewScheduleID" json:"interview_schedule,omitempty"`

	// Relations
	Payrolls      []Payroll      `gorm:"foreignKey:EmploymentAgreementID" json:"payrolls,omitempty"`
	Documents     []Document     `gorm:"foreignKey:EmploymentAgreementID" json:"documents,omitempty"`
	Notifications []Notification `gorm:"foreignKey:EmploymentAgreementID" json:"notifications,omitempty"`
}

// Document is a contract file attached to an EmploymentAgreement (e.g. the signed
// agreement PDF), per B6733827's class diagram class 10 (subsystem 1) / class 2
// (subsystem 2) — the same Document class shared across both subsystems.
//
// Per the class diagram a Document links to both an InterviewSchedule and an
// EmploymentAgreement. InterviewScheduleID is nullable so a document can be tied
// back to the specific interview it originated from without requiring one.
type Document struct {
	gorm.Model
	// Nullable so the history page can also list documents that belong to an
	// interview only (IV-xxxx) and not to any agreement (AG-xxxx).
	EmploymentAgreementID *uint      `gorm:"index" json:"employment_agreement_id"`
	InterviewScheduleID   *uint      `gorm:"index" json:"interview_schedule_id"`
	FileName              string     `gorm:"size:255;not null" json:"file_name"`
	File                  string     `gorm:"size:500" json:"file"` // URL / file path
	DocumentType          string     `gorm:"size:100" json:"document_type"`
	CreatedDate           *time.Time `json:"created_date"`
}
