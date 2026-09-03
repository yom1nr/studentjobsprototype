package dto

// EmployerApprovalResponse is an admin-facing view of an employer's approval record.
type EmployerApprovalResponse struct {
    EmployerID     uint   `json:"employer_id"`
    UserID         uint   `json:"user_id"`
    Email          string `json:"email"`
    Phone          string `json:"phone"`
    FirstName      string `json:"first_name"`
    LastName       string `json:"last_name"`
    Position       string `json:"position"`
    CompanyName    string `json:"company_name"`
    BusinessType   string `json:"business_type"`
    TaxID          string `json:"tax_id"`
    CompanyAddress string `json:"company_address"`
    // Uploaded verification documents (URLs from POST /upload), shown to the
    // admin while reviewing and used to decide approve / reject / request more.
    CompanyRegis string `json:"company_regis"`
    Logo         string `json:"logo"`
    CardID       string `json:"card_id"`
    Status       string `json:"status"` // pending | request_document | approved | rejected
    DateOfSignUp string `json:"date_of_sign_up"`
}

// RequestDocumentsRequest is the optional note an admin sends when asking an
// employer for more verification documents.
type RequestDocumentsRequest struct {
    Note string `json:"note" validate:"omitempty,max=500"`
}

type RejectEmployerRequest struct {
    Reason string `json:"reason" validate:"required,min=1,max=500"`
}
