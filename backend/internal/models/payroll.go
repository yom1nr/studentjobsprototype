package models

import (
	"time"
)

// Payroll matches the T04_Week06_B6729875 Class Diagram (Analysis level):
// PayrollID as its own PK, AgreementID (not EmploymentAgreementID) as the FK,
// and no direct EmployerID -- the employer is reached through the agreement.
type Payroll struct {
	PayrollID      uint       `gorm:"primaryKey;autoIncrement" json:"payroll_id"`
	AgreementID    uint       `gorm:"not null;index" json:"agreement_id"`
	CycleStartDate *time.Time `json:"cycle_start_date"`
	CycleEndDate   *time.Time `json:"cycle_end_date"`
	TotalHours     float64    `gorm:"type:decimal(8,2)" json:"total_hours"`
	NetPayAmount   float64    `gorm:"type:decimal(10,2)" json:"net_pay_amount"`
	PaymentStatus  string     `gorm:"size:50;not null;default:'pending'" json:"payment_status"` // pending | paid | cancelled
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	Payslip *Payslip `gorm:"foreignKey:PayrollID" json:"payslip,omitempty"`
}

// Payslip matches the same diagram: PayslipID as its own PK.
type Payslip struct {
	PayslipID           uint       `gorm:"primaryKey;autoIncrement" json:"payslip_id"`
	PayrollID           uint       `gorm:"not null;uniqueIndex" json:"payroll_id"`
	StudentID           uint       `gorm:"not null;index" json:"student_id"`
	TransferEvidenceURL string     `gorm:"size:500" json:"transfer_evidence_url"`
	TransferDateTime    *time.Time `json:"transfer_date_time"`
	IsStudentConfirmed  bool       `gorm:"default:false" json:"is_student_confirmed"`
	CreatedAt           time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}
