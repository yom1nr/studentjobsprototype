package dto

// CreateInterviewRequest schedules an interview appointment for a student the
// employer wants to interview.
type CreateInterviewRequest struct {
	StudentID          uint   `json:"student_id" validate:"required"`
	InterviewFormat    string `json:"interview_format" validate:"required,oneof=onsite online"`
	AppointmentDate    string `json:"appointment_date" validate:"required"` // "2026-07-24"
	AppointmentTime    string `json:"appointment_time" validate:"required"` // "13:30"
	Location           string `json:"location" validate:"omitempty"`
	PreparationDetails string `json:"preparation_details" validate:"omitempty"`
}

// UpdateInterviewRequest edits an existing interview's appointment details.
type UpdateInterviewRequest struct {
	InterviewFormat    string `json:"interview_format" validate:"required,oneof=onsite online"`
	AppointmentDate    string `json:"appointment_date" validate:"required"`
	AppointmentTime    string `json:"appointment_time" validate:"required"`
	Location           string `json:"location" validate:"omitempty"`
	PreparationDetails string `json:"preparation_details" validate:"omitempty"`
}

// InterviewResponse is an interview schedule enriched with student/employer display fields.
type InterviewResponse struct {
	ID                 uint                  `json:"id"`
	StudentID          uint                  `json:"student_id"`
	StudentName        string                `json:"student_name"`
	EmployerID         uint                  `json:"employer_id"`
	CompanyName        string                `json:"company_name"`
	InterviewFormat    string                `json:"interview_format"`
	AppointmentDate    string                `json:"appointment_date"`
	AppointmentTime    string                `json:"appointment_time"`
	Location           string                `json:"location"`
	PreparationDetails string                `json:"preparation_details"`
	CreatedAt          string                `json:"created_at"`
	Reschedules        []RescheduleResponse  `json:"reschedules,omitempty"`
}

// RequestRescheduleRequest asks the other party to propose/confirm a new time.
// Reason doubles as the free-text note either side sends (e.g. the employer's
// "please tell me your availability" question, or the student's own reason).
type RequestRescheduleRequest struct {
	Reason                   string `json:"reason" validate:"required"`
	StudentAvailableDateTime string `json:"student_available_date_time" validate:"omitempty"`
	NewAppointmentDateTime   string `json:"new_appointment_date_time" validate:"omitempty"`
}

// RescheduleResponse is one entry in an interview's reschedule history.
type RescheduleResponse struct {
	ID                       uint   `json:"id"`
	StudentAvailableDateTime string `json:"student_available_date_time"`
	NewAppointmentDateTime   string `json:"new_appointment_date_time"`
	RescheduleReason         string `json:"reschedule_reason"`
	CreatedAt                string `json:"created_at"`
}

// InterviewResultRequest lets the employer notify a student of the interview outcome.
// There's no persisted result field on InterviewSchedule (not in the class
// diagram) — "passed" is captured for real once an EmploymentAgreement is
// created for that student; this endpoint only sends the notification.
type InterviewResultRequest struct {
	Result  string `json:"result" validate:"required,oneof=passed failed"`
	Comment string `json:"comment" validate:"omitempty"`
}
