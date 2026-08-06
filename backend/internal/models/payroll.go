package models

import (
	"time"

	"gorm.io/gorm"
)

type Payroll struct {
	gorm.Model
	EmploymentAgreementID uint      `gorm:"not null;index" json:"employment_agreement_id"`
	EmployerID            uint      `gorm:"not null;index" json:"employer_id"`
	CycleStartDate        *time.Time `json:"cycle_start_date"`
	CycleEndDate          *time.Time `json:"cycle_end_date"`
	TotalHours            float64   `gorm:"type:decimal(8,2)" json:"total_hours"`
	NetPayAmount          float64   `gorm:"type:decimal(10,2)" json:"net_pay_amount"`
	PaymentStatus         string    `gorm:"size:50;not null;default:'pending'" json:"payment_status"` // pending | paid | cancelled

	Payslip *Payslip `gorm:"foreignKey:PayrollID" json:"payslip,omitempty"`
}

type Payslip struct {
	gorm.Model
	PayrollID           uint      `gorm:"not null;uniqueIndex" json:"payroll_id"`
	StudentID           uint      `gorm:"not null;index" json:"student_id"`
	TransferEvidenceURL string    `gorm:"size:500" json:"transfer_evidence_url"`
	TransferDateTime    *time.Time `json:"transfer_date_time"`
	IsStudentConfirmed  bool      `gorm:"default:false" json:"is_student_confirmed"`
}