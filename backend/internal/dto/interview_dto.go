package dto

// CreateInterviewRequest schedules an interview appointment for a student the
// employer wants to interview.
type CreateInterviewRequest struct {
	// ApplicationID says which accepted application this interview is for; the
	// student is taken from it. Interviews are per application, not per student,
	// so someone who applied for two of your positions gets two appointments.
	ApplicationID      uint   `json:"application_id" validate:"required"`
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
	ID                 uint                 `json:"id"`
	ApplicationID      *uint                `json:"application_id"`
	StudentID          uint                 `json:"student_id"`
	StudentName        string               `json:"student_name"`
	EmployerID         uint                 `json:"employer_id"`
	CompanyName        string               `json:"company_name"`
	InterviewFormat    string               `json:"interview_format"`
	AppointmentDate    string               `json:"appointment_date"`
	AppointmentTime    string               `json:"appointment_time"`
	Location           string               `json:"location"`
	PreparationDetails string               `json:"preparation_details"`
	Status             string               `json:"status"`
	Result             string               `json:"result"`
	ResultComment      string               `json:"result_comment"`
	CreatedAt          string               `json:"created_at"`
	Reschedules        []RescheduleResponse `json:"reschedules,omitempty"`
}

// RequestRescheduleRequest is the student asking to move an interview to a
// single time; the employer then approves or rejects it. Reason is the
// student's free-text note for why.
type RequestRescheduleRequest struct {
	Reason                   string `json:"reason" validate:"required"`
	StudentAvailableDateTime string `json:"student_available_date_time" validate:"required"`
}

// OfferRescheduleSlotsRequest is the employer offering the student several
// times to choose from instead of asking the student for one. There is no
// approval step after the student's pick — the employer already committed to
// every slot listed here.
type OfferRescheduleSlotsRequest struct {
	Reason string `json:"reason" validate:"required"`
	// RFC3339, in UTC (see utcInstant), up to 5.
	ProposedSlots []string `json:"proposed_slots" validate:"required,min=1,max=5,dive,required"`
}

// SelectRescheduleSlotRequest is the student picking one of the slots the
// employer offered. The value must be one of that request's proposed slots.
type SelectRescheduleSlotRequest struct {
	SelectedDateTime string `json:"selected_date_time" validate:"required"`
}

// RejectRescheduleRequest is the employer declining a student's proposed time.
type RejectRescheduleRequest struct {
	Reason string `json:"reason" validate:"omitempty"`
}

// RescheduleResponse is one entry in an interview's reschedule history.
type RescheduleResponse struct {
	ID                       uint     `json:"id"`
	RequestedBy              string   `json:"requested_by"` // student | employer
	Status                   string   `json:"status"`       // pending | accepted | rejected
	StudentAvailableDateTime string   `json:"student_available_date_time"`
	ProposedSlots            []string `json:"proposed_slots"`
	NewAppointmentDateTime   string   `json:"new_appointment_date_time"`
	RescheduleReason         string   `json:"reschedule_reason"`
	RespondedAt              string   `json:"responded_at"`
	CreatedAt                string   `json:"created_at"`
}

// InterviewResultRequest lets the employer notify a student of the interview outcome.
// The result is persisted on InterviewSchedule (Result / ResultComment /
// ResultAnnouncedAt) as well as sent as a notification, so the student can
// re-open the result page and the employer can see who has already been told.
type InterviewResultRequest struct {
	Result  string `json:"result" validate:"required,oneof=passed failed"`
	Comment string `json:"comment" validate:"omitempty"`
}
