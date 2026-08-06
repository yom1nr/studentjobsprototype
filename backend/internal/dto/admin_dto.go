package dto

// EmployerApprovalResponse is an admin-facing view of an employer's approval record.
type EmployerApprovalResponse struct {
    EmployerID     uint   `json:"employer_id"`
    UserID         uint   `json:"user_id"`
    Email          string `json:"email"`
    FirstName      string `json:"first_name"`
    LastName       string `json:"last_name"`
    CompanyName    string `json:"company_name"`
    BusinessType   string `json:"business_type"`
    TaxID          string `json:"tax_id"`
    CompanyAddress string `json:"company_address"`
    Status         string `json:"status"`
    DateOfSignUp   string `json:"date_of_sign_up"`
}

type RejectEmployerRequest struct {
    Reason string `json:"reason" validate:"required,min=1,max=500"`
}
