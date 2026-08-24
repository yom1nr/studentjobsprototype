package dto

// CreatePayrollRequest computes and records a pay cycle for a student's accepted agreement.
type CreatePayrollRequest struct {
	EmploymentAgreementID uint   `json:"employment_agreement_id" validate:"required"`
	CycleStartDate        string `json:"cycle_start_date" validate:"required"` // YYYY-MM-DD
	CycleEndDate          string `json:"cycle_end_date" validate:"required"`   // YYYY-MM-DD
}

// PayrollResponse is a payroll cycle enriched with display fields.
type PayrollResponse struct {
	ID                    uint    `json:"id"`
	EmploymentAgreementID uint    `json:"employment_agreement_id"`
	StudentID             uint    `json:"student_id"`
	StudentName           string  `json:"student_name"`
	EmployerID            uint    `json:"employer_id"`
	CompanyName           string  `json:"company_name"`
	CycleStartDate        string  `json:"cycle_start_date"`
	CycleEndDate          string  `json:"cycle_end_date"`
	TotalHours            float64 `json:"total_hours"`
	WageRate              float64 `json:"wage_rate"`
	NetPayAmount          float64 `json:"net_pay_amount"`
	PaymentStatus         string  `json:"payment_status"`
	IsStudentConfirmed    bool    `json:"is_student_confirmed"`
	TransferDateTime      string  `json:"transfer_date_time"`
	CreatedAt             string  `json:"created_at"`
}
