package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/dto"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// PayrollController manages pay-cycle calculation and payment confirmation (B6729875 subsystem 2).
type PayrollController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewPayrollController creates a new PayrollController.
func NewPayrollController(db *gorm.DB) *PayrollController {
	return &PayrollController{db: db, validate: validator.New()}
}

// CreatePayroll computes a pay cycle for a student's accepted agreement from
// their completed time records in the given date range, and drafts a Payslip.
func (h *PayrollController) CreatePayroll(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	var payload dto.CreatePayrollRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	var agreement models.EmploymentAgreement
	if err := h.db.Where("id = ? AND employer_id = ? AND status = ?", payload.EmploymentAgreementID, employer.ID, "accepted").First(&agreement).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "agreement not found", "no accepted agreement exists with the given id for your account")
		return
	}

	start, err := time.Parse("2006-01-02", payload.CycleStartDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid cycle_start_date", "expected format YYYY-MM-DD")
		return
	}
	end, err := time.Parse("2006-01-02", payload.CycleEndDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid cycle_end_date", "expected format YYYY-MM-DD")
		return
	}
	endExclusive := end.Add(24 * time.Hour)

	var records []models.TimeRecord
	h.db.Where("student_id = ? AND check_out_time IS NOT NULL AND check_in_time >= ? AND check_in_time < ?",
		agreement.StudentID, start, endExclusive).Find(&records)

	totalHours := 0.0
	for _, r := range records {
		totalHours += r.CheckOutTime.Sub(r.CheckInTime).Hours()
	}
	netPay := totalHours * agreement.WageRate

	payroll := &models.Payroll{
		EmploymentAgreementID: agreement.ID,
		EmployerID:            employer.ID,
		CycleStartDate:        &start,
		CycleEndDate:          &end,
		TotalHours:            totalHours,
		NetPayAmount:          netPay,
		PaymentStatus:         "pending",
	}
	if err := h.db.Create(payroll).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}
	payslip := &models.Payslip{
		PayrollID:          payroll.ID,
		StudentID:          agreement.StudentID,
		IsStudentConfirmed: false,
	}
	if err := h.db.Create(payslip).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", err.Error())
		return
	}
	payroll.Payslip = payslip

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(payroll, employer.CompanyName, h.studentName(agreement.StudentID)))
}

// ApprovePayroll marks a payroll cycle as paid (transferred), awaiting student confirmation.
func (h *PayrollController) ApprovePayroll(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	payroll, ok := h.ownedByEmployer(c, employer.ID)
	if !ok {
		return
	}
	if payroll.PaymentStatus != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this payroll cycle has already been processed")
		return
	}

	payroll.PaymentStatus = "paid"
	if err := h.db.Save(payroll).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "approve failed", err.Error())
		return
	}

	now := time.Now().UTC()
	h.db.Model(&models.Payslip{}).Where("payroll_id = ?", payroll.ID).Update("transfer_date_time", &now)

	var agreement models.EmploymentAgreement
	h.db.First(&agreement, payroll.EmploymentAgreementID)
	var student models.Student
	if h.db.First(&student, agreement.StudentID).Error == nil {
		notifyUser(h.db, student.UserID, "โอนค่าตอบแทนแล้ว", "payroll_paid",
			fmt.Sprintf("ได้รับการโอนค่าตอบแทน %.2f บาท กรุณายืนยันการรับเงิน", payroll.NetPayAmount))
	}

	h.db.Preload("Payslip").First(payroll, payroll.ID)
	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(payroll, employer.CompanyName, h.studentName(agreement.StudentID)))
}

// ListMine returns payroll cycles scoped to the current user's role.
func (h *PayrollController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	var payrolls []models.Payroll

	if role == "employer" {
		employer, ok := h.currentEmployer(c)
		if !ok {
			return
		}
		if err := h.db.Preload("Payslip").Where("employer_id = ?", employer.ID).Order("created_at DESC").Find(&payrolls).Error; err != nil {
			utils.JSONError(c, http.StatusInternalServerError, "failed to load payrolls", err.Error())
			return
		}
		responses := make([]dto.PayrollResponse, 0, len(payrolls))
		for i := range payrolls {
			var agreement models.EmploymentAgreement
			h.db.First(&agreement, payrolls[i].EmploymentAgreementID)
			responses = append(responses, h.mapToResponse(&payrolls[i], employer.CompanyName, h.studentName(agreement.StudentID)))
		}
		utils.JSONSuccess(c, http.StatusOK, responses)
		return
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}
	if err := h.db.Preload("Payslip").Joins("JOIN payslips ON payslips.payroll_id = payrolls.id").
		Where("payslips.student_id = ?", student.ID).Order("payrolls.created_at DESC").Find(&payrolls).Error; err != nil {
		utils.JSONError(c, http.StatusInternalServerError, "failed to load payrolls", err.Error())
		return
	}
	responses := make([]dto.PayrollResponse, 0, len(payrolls))
	for i := range payrolls {
		responses = append(responses, h.mapToResponse(&payrolls[i], h.companyName(payrolls[i].EmployerID), h.studentName(student.ID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ConfirmReceipt lets the student confirm they received the transferred pay.
func (h *PayrollController) ConfirmReceipt(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}
	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid payroll id", "id must be a number")
		return
	}
	var payroll models.Payroll
	if err := h.db.Preload("Payslip").First(&payroll, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "payroll not found", "no payroll cycle exists with the given id")
		return
	}
	if payroll.Payslip == nil || payroll.Payslip.StudentID != student.ID {
		utils.JSONError(c, http.StatusNotFound, "payroll not found", "no payroll cycle exists with the given id")
		return
	}
	if payroll.PaymentStatus != "paid" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this payroll cycle hasn't been paid yet")
		return
	}

	h.db.Model(&models.Payslip{}).Where("payroll_id = ?", payroll.ID).Update("is_student_confirmed", true)

	var employer models.Employer
	if h.db.First(&employer, payroll.EmployerID).Error == nil {
		notifyUser(h.db, employer.UserID, "นักศึกษายืนยันรับเงินแล้ว", "payroll_confirmed",
			fmt.Sprintf("%s ยืนยันการรับเงิน %.2f บาทแล้ว", h.studentName(student.ID), payroll.NetPayAmount))
	}

	h.db.Preload("Payslip").First(&payroll, payroll.ID)
	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(&payroll, h.companyName(payroll.EmployerID), h.studentName(student.ID)))
}

func (h *PayrollController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}
	var employer models.Employer
	if err := h.db.Where("user_id = ?", userID).First(&employer).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your company profile first")
		} else {
			utils.JSONError(c, http.StatusBadRequest, "action failed", err.Error())
		}
		return nil, false
	}
	return &employer, true
}

func (h *PayrollController) ownedByEmployer(c *gin.Context, employerID uint) (*models.Payroll, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid payroll id", "id must be a number")
		return nil, false
	}
	var payroll models.Payroll
	if err := h.db.Preload("Payslip").Where("id = ? AND employer_id = ?", id, employerID).First(&payroll).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "payroll not found", "no payroll cycle exists with the given id")
		return nil, false
	}
	return &payroll, true
}

func (h *PayrollController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *PayrollController) companyName(employerID uint) string {
	var employer models.Employer
	if err := h.db.Select("company_name").First(&employer, employerID).Error; err != nil {
		return ""
	}
	return employer.CompanyName
}

func (h *PayrollController) mapToResponse(p *models.Payroll, companyName, studentName string) dto.PayrollResponse {
	start, end := "", ""
	if p.CycleStartDate != nil {
		start = p.CycleStartDate.Format("2006-01-02")
	}
	if p.CycleEndDate != nil {
		end = p.CycleEndDate.Format("2006-01-02")
	}
	confirmed := false
	transferAt := ""
	studentID := uint(0)
	if p.Payslip != nil {
		confirmed = p.Payslip.IsStudentConfirmed
		studentID = p.Payslip.StudentID
		if p.Payslip.TransferDateTime != nil {
			transferAt = p.Payslip.TransferDateTime.Format(time.RFC3339)
		}
	}
	rate := 0.0
	if p.TotalHours > 0 {
		rate = p.NetPayAmount / p.TotalHours
	}
	return dto.PayrollResponse{
		ID:                    p.ID,
		EmploymentAgreementID: p.EmploymentAgreementID,
		StudentID:             studentID,
		StudentName:           studentName,
		EmployerID:            p.EmployerID,
		CompanyName:           companyName,
		CycleStartDate:        start,
		CycleEndDate:          end,
		TotalHours:            p.TotalHours,
		WageRate:              rate,
		NetPayAmount:          p.NetPayAmount,
		PaymentStatus:         p.PaymentStatus,
		IsStudentConfirmed:    confirmed,
		TransferDateTime:      transferAt,
		CreatedAt:             p.CreatedAt.Format(time.RFC3339),
	}
}
