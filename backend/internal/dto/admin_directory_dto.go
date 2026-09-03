package dto

// EmployerDirectoryResponse is the full employer-account view shown in the
// admin's employer directory (separate from the pending-approval queue).
type EmployerDirectoryResponse struct {
    EmployerID     uint   `json:"employer_id"`
    UserID         uint   `json:"user_id"`
    Email          string `json:"email"`
    Phone          string `json:"phone"`
    Gender         string `json:"gender"`
    FirstName      string `json:"first_name"`
    LastName       string `json:"last_name"`
    Position       string `json:"position"`
    LineID         string `json:"line_id"`
    CompanyName    string `json:"company_name"`
    BusinessType   string `json:"business_type"`
    TaxID          string `json:"tax_id"`
    Link           string `json:"link"`
    CompanyAddress string `json:"company_address"`
}

// AdminUpdateEmployerRequest lets an admin edit any field of an employer
// account. Pointer fields are optional: only the fields sent are changed.
type AdminUpdateEmployerRequest struct {
    FirstName      *string `json:"first_name" validate:"omitempty,min=1,max=100"`
    LastName       *string `json:"last_name" validate:"omitempty,min=1,max=100"`
    Email          *string `json:"email" validate:"omitempty,email,max=150"`
    Phone          *string `json:"phone" validate:"omitempty,max=20"`
    Gender         *string `json:"gender" validate:"omitempty,max=20"`
    Position       *string `json:"position" validate:"omitempty,max=100"`
    LineID         *string `json:"line_id" validate:"omitempty,max=100"`
    CompanyName    *string `json:"company_name" validate:"omitempty,min=1,max=150"`
    BusinessType   *string `json:"business_type" validate:"omitempty,max=100"`
    TaxID          *string `json:"tax_id" validate:"omitempty,max=50"`
    Link           *string `json:"link" validate:"omitempty,max=255"`
    CompanyAddress *string `json:"company_address"`
}

// StudentDirectoryResponse is the full student-account view shown in the
// admin's student directory.
type StudentDirectoryResponse struct {
    StudentID   uint   `json:"student_id"`
    UserID      uint   `json:"user_id"`
    Email       string `json:"email"`
    Phone       string `json:"phone"`
    Gender      string `json:"gender"`
    FirstName   string `json:"first_name"`
    LastName    string `json:"last_name"`
    DateOfBirth string `json:"date_of_birth"`
    Address     string `json:"address"`
    University  string `json:"university"`
    Faculty     string `json:"faculty"`
    Major       string `json:"major"`
    Years       string `json:"years"`
    Skill       string `json:"skill"`
}

// AdminAuditLogResponse is one entry in the admin audit trail.
type AdminAuditLogResponse struct {
    ID          uint   `json:"id"`
    AdminID     *uint  `json:"admin_id"`
    AdminEmail  string `json:"admin_email"`
    Action      string `json:"action"`
    TargetType  string `json:"target_type"`
    TargetID    uint   `json:"target_id"`
    TargetLabel string `json:"target_label"`
    Changes     string `json:"changes"` // JSON object: {"field":{"from":...,"to":...}}
    CreatedAt   string `json:"created_at"`
}

// AdminUpdateStudentRequest lets an admin edit any field of a student
// account. Pointer fields are optional: only the fields sent are changed.
type AdminUpdateStudentRequest struct {
    FirstName   *string `json:"first_name" validate:"omitempty,min=1,max=100"`
    LastName    *string `json:"last_name" validate:"omitempty,min=1,max=100"`
    Email       *string `json:"email" validate:"omitempty,email,max=150"`
    Phone       *string `json:"phone" validate:"omitempty,max=20"`
    Gender      *string `json:"gender" validate:"omitempty,max=20"`
    DateOfBirth *string `json:"date_of_birth" validate:"omitempty"`
    Address     *string `json:"address" validate:"omitempty,max=255"`
    University  *string `json:"university" validate:"omitempty,max=150"`
    Faculty     *string `json:"faculty" validate:"omitempty,max=150"`
    Major       *string `json:"major" validate:"omitempty,max=150"`
    Years       *string `json:"years" validate:"omitempty,max=10"`
    Skill       *string `json:"skill" validate:"omitempty"`
}
