package dto

// CheckInRequest starts a new time record at the student's current location.
type CheckInRequest struct {
	Latitude  float64 `json:"latitude" validate:"required"`
	Longitude float64 `json:"longitude" validate:"required"`
}

// CheckOutRequest closes an open time record.
type CheckOutRequest struct {
	Latitude  float64 `json:"latitude" validate:"omitempty"`
	Longitude float64 `json:"longitude" validate:"omitempty"`
}

// TimeRecordResponse is a time record enriched with computed hours.
type TimeRecordResponse struct {
	ID            uint    `json:"id"`
	StudentID     uint    `json:"student_id"`
	StudentName   string  `json:"student_name"`
	CheckInTime   string  `json:"check_in_time"`
	CheckOutTime  string  `json:"check_out_time"`
	Hours         float64 `json:"hours"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	RecordStatus  string  `json:"record_status"`
	EditRequest   *TimeEditRequestResponse `json:"edit_request,omitempty"`
}

// CreateTimeEditRequest asks the employer to correct a time record.
type CreateTimeEditRequest struct {
	NewCheckInTime  string `json:"new_check_in_time" validate:"required"`  // RFC3339
	NewCheckOutTime string `json:"new_check_out_time" validate:"required"` // RFC3339
	Reason          string `json:"reason" validate:"required"`
}

// RejectTimeEditRequest is the employer's reason for declining a time-edit request.
type RejectTimeEditRequest struct {
	Reason string `json:"reason" validate:"omitempty"`
}

// TimeEditRequestResponse is a time-edit request enriched with display fields.
type TimeEditRequestResponse struct {
	ID              uint   `json:"id"`
	TimeRecordID    uint   `json:"time_record_id"`
	StudentName     string `json:"student_name"`
	OldCheckInTime  string `json:"old_check_in_time"`
	OldCheckOutTime string `json:"old_check_out_time"`
	NewCheckInTime  string `json:"new_check_in_time"`
	NewCheckOutTime string `json:"new_check_out_time"`
	Reason          string `json:"reason"`
	RequestStatus   string `json:"request_status"`
	CreatedAt       string `json:"created_at"`
}
