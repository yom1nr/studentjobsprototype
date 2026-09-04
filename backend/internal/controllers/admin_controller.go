package controllers

import (
    "encoding/json"
    "errors"
    "log"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/go-playground/validator/v10"
    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/dto"
    "github.com/SA/Golang-Backend-Example/internal/models"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// AdminController manages the employer-verification workflow.
type AdminController struct {
    db       *gorm.DB
    validate *validator.Validate
}

// NewAdminController creates a new AdminController.
func NewAdminController(db *gorm.DB) *AdminController {
    return &AdminController{db: db, validate: validator.New()}
}

// ListEmployerApprovals returns employers filtered by approval status
// (?status=pending|approved|rejected, defaults to pending).
func (h *AdminController) ListEmployerApprovals(c *gin.Context) {
    status := c.DefaultQuery("status", "pending")

    var users []models.User
    if err := h.db.
        Preload("Employer.Approve").
        Preload("Employer.AttachmentEmployer").
        Where("role = ?", "employer").
        Find(&users).Error; err != nil {
        utils.JSONInternalError(c, "failed to load employers", err)
        return
    }

    responses := make([]dto.EmployerApprovalResponse, 0)
    for _, user := range users {
        if user.Employer == nil || user.Employer.Approve == nil {
            continue
        }
        // "pending" is the review queue: it also surfaces employers who were
        // asked for more documents but haven't been approved/rejected yet.
        if status == "pending" {
            if user.Employer.Approve.Status != "pending" && user.Employer.Approve.Status != "request_document" {
                continue
            }
        } else if user.Employer.Approve.Status != status {
            continue
        }
        responses = append(responses, mapEmployerApprovalToResponse(&user, user.Employer))
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// GetEmployerDetail returns one employer's profile + approval record by Employer ID.
func (h *AdminController) GetEmployerDetail(c *gin.Context) {
    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONInternalError(c, "failed to load employer", err)
        return
    }
    if employer == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "no employer exists with the given id")
        return
    }

    var user models.User
    if err := h.db.First(&user, employer.UserID).Error; err != nil {
        utils.JSONInternalError(c, "failed to load employer", err)
        return
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalToResponse(&user, employer))
}

// ApproveEmployer approves an employer's pending registration and notifies them.
func (h *AdminController) ApproveEmployer(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONInternalError(c, "approval failed", err)
        return
    }
    if employer == nil || employer.Approve == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "employer has no approval record")
        return
    }

    employer.Approve.Status = "approved"
    employer.Approve.AdminID = &admin.UserID
    if err := h.db.Save(employer.Approve).Error; err != nil {
        utils.JSONInternalError(c, "approval failed", err)
        return
    }

    notifyUser(h.db, employer.UserID, "บัญชีผู้ประกอบการได้รับการอนุมัติ", "employer_approval",
        "บัญชีผู้ประกอบการของคุณได้รับการอนุมัติเรียบร้อยแล้ว สามารถเริ่มประกาศรับสมัครงานได้ทันที")

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalStatus(employer))
}

// RejectEmployer rejects an employer's pending registration with a reason and notifies them.
func (h *AdminController) RejectEmployer(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    var payload dto.RejectEmployerRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONInternalError(c, "rejection failed", err)
        return
    }
    if employer == nil || employer.Approve == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "employer has no approval record")
        return
    }

    employer.Approve.Status = "rejected"
    employer.Approve.AdminID = &admin.UserID
    if err := h.db.Save(employer.Approve).Error; err != nil {
        utils.JSONInternalError(c, "rejection failed", err)
        return
    }

    notifyUser(h.db, employer.UserID, "บัญชีผู้ประกอบการไม่ผ่านการอนุมัติ", "employer_rejection",
        "บัญชีผู้ประกอบการของคุณไม่ผ่านการอนุมัติ เหตุผล: "+payload.Reason)

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalStatus(employer))
}

// RequestDocuments puts an employer's registration into the "request_document"
// state and notifies them to attach more verification documents. The employer
// stays in the admin's pending queue until they are approved or rejected (FR2:
// เจ้าหน้าที่แจ้งให้แก้ไข/ส่งเอกสารเพิ่มเติม).
func (h *AdminController) RequestDocuments(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    var payload dto.RequestDocumentsRequest
    _ = c.ShouldBindJSON(&payload)

    employer, err := h.findEmployerByID(employerID)
    if err != nil {
        utils.JSONInternalError(c, "request failed", err)
        return
    }
    if employer == nil || employer.Approve == nil {
        utils.JSONError(c, http.StatusNotFound, "employer not found", "employer has no approval record")
        return
    }

    employer.Approve.Status = "request_document"
    employer.Approve.AdminID = &admin.UserID
    employer.Approve.RequestNote = payload.Note
    employer.Approve.RequestNoteAckAt = nil
    if err := h.db.Save(employer.Approve).Error; err != nil {
        utils.JSONInternalError(c, "request failed", err)
        return
    }

    message := "กรุณาแนบเอกสารยืนยันตัวตนบริษัทของคุณเพิ่มเติม เพื่อประกอบการอนุมัติบัญชี"
    if payload.Note != "" {
        message += " หมายเหตุ: " + payload.Note
    }
    notifyUser(h.db, employer.UserID, "ขอเอกสารยืนยันเพิ่มเติม", "employer_request_doc", message)

    utils.JSONSuccess(c, http.StatusOK, mapEmployerApprovalStatus(employer))
}

func (h *AdminController) currentAdmin(c *gin.Context) (*models.Admin, bool) {
    adminUserID, ok := utils.GetUserIDFromContext(c)
    if !ok {
        utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
        return nil, false
    }

    var admin models.Admin
    if err := h.db.Where("user_id = ?", adminUserID).First(&admin).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            utils.JSONError(c, http.StatusBadRequest, "action failed", "admin profile not found for current user")
        } else {
            utils.JSONInternalError(c, "action failed", err)
        }
        return nil, false
    }

    return &admin, true
}

func (h *AdminController) findEmployerByID(id uint) (*models.Employer, error) {
    var employer models.Employer
    err := h.db.Preload("Approve").Preload("AttachmentEmployer").First(&employer, id).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &employer, nil
}

// notifyUser writes an in-app notification. Best-effort: a notification failure
// shouldn't roll back an approval/rejection decision that already succeeded.
func notifyUser(db *gorm.DB, userID uint, title, notificationType, message string) {
    notification := &models.Notification{
        UserID:           userID,
        Title:            title,
        NotificationType: notificationType,
        Message:          message,
    }
    if err := db.Create(notification).Error; err != nil {
        log.Printf("failed to create notification for user %d: %v", userID, err)
    }
}

func mapEmployerApprovalToResponse(user *models.User, employer *models.Employer) dto.EmployerApprovalResponse {
    status := ""
    dateOfSignUp := ""
    requestNote := ""
    requestNoteAck := false
    if employer.Approve != nil {
        status = employer.Approve.Status
        dateOfSignUp = employer.Approve.DateOfSignUp.Format(time.RFC3339)
        requestNote = employer.Approve.RequestNote
        requestNoteAck = employer.Approve.RequestNoteAckAt != nil
    }

    companyRegis, logo, cardID := "", "", ""
    if employer.AttachmentEmployer != nil {
        companyRegis = employer.AttachmentEmployer.CompanyRegis
        logo = employer.AttachmentEmployer.Logo
        cardID = employer.AttachmentEmployer.CardID
    }

    return dto.EmployerApprovalResponse{
        EmployerID:              employer.UserID,
        UserID:                  user.UserID,
        Email:                   user.Email,
        Phone:                   user.Phone,
        FirstName:               employer.FirstName,
        LastName:                employer.LastName,
        Position:                employer.Position,
        CompanyName:             employer.CompanyName,
        BusinessType:            employer.BusinessType,
        TaxID:                   employer.TaxID,
        CompanyAddress:          employer.CompanyAddress,
        CompanyRegis:            companyRegis,
        Logo:                    logo,
        CardID:                  cardID,
        Status:                  status,
        DateOfSignUp:            dateOfSignUp,
        RequestNote:             requestNote,
        RequestNoteAcknowledged: requestNoteAck,
    }
}

func mapEmployerApprovalStatus(employer *models.Employer) gin.H {
    return gin.H{
        "employer_id": employer.UserID,
        "status":      employer.Approve.Status,
        "reviewed_at": time.Now().UTC().Format(time.RFC3339),
    }
}

// ─── Employer / student directory + admin audit trail ───────────────────────
// An admin can browse every employer/student account and edit its fields. Every
// edit that actually changes something is written to admin_audit_logs in the
// same transaction as the row itself (TA requirement: no silent admin edits).

// ListAllEmployers returns every employer account (not just pending approvals)
// for the admin's employer directory.
func (h *AdminController) ListAllEmployers(c *gin.Context) {
    limit, offset := utils.ReadPage(c, 500)
    // Queried from Employer, not User: a User-rooted query with LIMIT/OFFSET
    // and a Go-side "skip rows with no Employer profile" filter can return
    // fewer than `limit` rows on a page even when more matching employers
    // exist further down (e.g. users who registered but never completed
    // onboarding sitting between two profiled ones). Employer is the FROM
    // table here, so every row this query can return already has a profile.
    var employers []models.Employer
    if err := h.db.Preload("User").
        Where("user_id IN (?)", h.db.Model(&models.User{}).Select("user_id").Where("role = ?", "employer")).
        Order("user_id").
        Limit(limit).Offset(offset).
        Find(&employers).Error; err != nil {
        utils.JSONInternalError(c, "failed to load employers", err)
        return
    }

    responses := make([]dto.EmployerDirectoryResponse, 0, len(employers))
    for i := range employers {
        if employers[i].User == nil {
            continue
        }
        responses = append(responses, mapEmployerToDirectoryResponse(employers[i].User, &employers[i]))
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// UpdateEmployer lets an admin edit any employer account's profile fields.
// The employer row, the linked user row, and the audit-log entry are written
// in one transaction so a partial failure rolls the whole edit back.
func (h *AdminController) UpdateEmployer(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    employerID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid employer id", "id must be a number")
        return
    }

    var payload dto.AdminUpdateEmployerRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }
    for _, f := range []struct {
        name string
        val  *string
    }{{"first_name", payload.FirstName}, {"last_name", payload.LastName}, {"email", payload.Email}, {"company_name", payload.CompanyName}} {
        if isBlankPatch(f.val) {
            utils.JSONError(c, http.StatusBadRequest, "validation error", f.name+" must not be empty")
            return
        }
    }

    var (
        respUser     models.User
        respEmployer models.Employer
        emailChanged bool
    )

    txErr := h.db.Transaction(func(tx *gorm.DB) error {
        var employer models.Employer
        if err := tx.First(&employer, employerID).Error; err != nil {
            return err
        }

        changes := auditChanges{}

        if payload.TaxID != nil && *payload.TaxID != employer.TaxID {
            var n int64
            if err := tx.Model(&models.Employer{}).Where("tax_id = ? AND user_id <> ?", *payload.TaxID, employer.UserID).Count(&n).Error; err != nil {
                return err
            }
            if n > 0 {
                return conflictError{"tax id already in use"}
            }
            changes.set("tax_id", employer.TaxID, *payload.TaxID)
            employer.TaxID = *payload.TaxID
        }
        applyStringField(&employer.FirstName, payload.FirstName, "first_name", changes)
        applyStringField(&employer.LastName, payload.LastName, "last_name", changes)
        applyStringField(&employer.Position, payload.Position, "position", changes)
        applyStringField(&employer.LineID, payload.LineID, "line_id", changes)
        applyStringField(&employer.CompanyName, payload.CompanyName, "company_name", changes)
        applyStringField(&employer.BusinessType, payload.BusinessType, "business_type", changes)
        applyStringField(&employer.Link, payload.Link, "link", changes)
        applyStringField(&employer.CompanyAddress, payload.CompanyAddress, "company_address", changes)
        if err := tx.Save(&employer).Error; err != nil {
            return err
        }

        var user models.User
        if err := tx.First(&user, employer.UserID).Error; err != nil {
            return err
        }
        if payload.Email != nil && *payload.Email != user.Email {
            var n int64
            if err := tx.Model(&models.User{}).Where("email = ? AND user_id <> ?", *payload.Email, user.UserID).Count(&n).Error; err != nil {
                return err
            }
            if n > 0 {
                return conflictError{"email already in use"}
            }
            changes.set("email", user.Email, *payload.Email)
            user.Email = *payload.Email
            emailChanged = true
        }
        applyStringField(&user.Phone, payload.Phone, "phone", changes)
        applyStringField(&user.Gender, payload.Gender, "gender", changes)
        if err := tx.Save(&user).Error; err != nil {
            return err
        }

        if len(changes) > 0 {
            entry := &models.AdminAuditLog{
                AdminID:     &admin.UserID,
                AdminEmail:  adminSnapshotEmail(tx, admin.UserID),
                Action:      "update_employer",
                TargetType:  "employer",
                TargetID:    employer.UserID,
                TargetLabel: employer.CompanyName,
                Changes:     changes.json(),
                IPAddress:   c.ClientIP(),
            }
            if err := tx.Create(entry).Error; err != nil {
                return err
            }
        }

        respUser, respEmployer = user, employer
        return nil
    })
    if txErr != nil {
        h.writeUpdateError(c, txErr)
        return
    }

    if emailChanged {
        notifyUser(h.db, respUser.UserID, "อีเมลบัญชีถูกเปลี่ยนโดยผู้ดูแลระบบ", "account_update",
            "ผู้ดูแลระบบได้เปลี่ยนอีเมลสำหรับเข้าสู่ระบบของบัญชีคุณเป็น "+respUser.Email+" หากคุณไม่ได้ร้องขอ กรุณาติดต่อผู้ดูแลระบบทันที")
    }

    utils.JSONSuccess(c, http.StatusOK, mapEmployerToDirectoryResponse(&respUser, &respEmployer))
}

// ListAllStudents returns every student account for the admin's student directory.
func (h *AdminController) ListAllStudents(c *gin.Context) {
    limit, offset := utils.ReadPage(c, 500)
    // Queried from Student, not User — same reasoning as ListAllEmployers:
    // rooting on the profile table is what makes LIMIT/OFFSET actually mean
    // "this many profiles", not "this many users, some of which turned out to
    // have no profile and got silently dropped".
    var students []models.Student
    if err := h.db.Preload("User").
        Where("user_id IN (?)", h.db.Model(&models.User{}).Select("user_id").Where("role = ?", "student")).
        Order("user_id").
        Limit(limit).Offset(offset).
        Find(&students).Error; err != nil {
        utils.JSONInternalError(c, "failed to load students", err)
        return
    }

    responses := make([]dto.StudentDirectoryResponse, 0, len(students))
    for i := range students {
        if students[i].User == nil {
            continue
        }
        responses = append(responses, mapStudentToDirectoryResponse(students[i].User, &students[i]))
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// UpdateStudent lets an admin edit any student account's profile fields.
// Student row, linked user row, and audit-log entry are written in one
// transaction so a partial failure rolls the whole edit back.
func (h *AdminController) UpdateStudent(c *gin.Context) {
    admin, ok := h.currentAdmin(c)
    if !ok {
        return
    }

    studentID, err := utils.ParseUintParam(c, "id")
    if err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid student id", "id must be a number")
        return
    }

    var payload dto.AdminUpdateStudentRequest
    if err := c.ShouldBindJSON(&payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
        return
    }
    if err := h.validate.Struct(payload); err != nil {
        utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
        return
    }
    for _, f := range []struct {
        name string
        val  *string
    }{{"first_name", payload.FirstName}, {"last_name", payload.LastName}, {"email", payload.Email}} {
        if isBlankPatch(f.val) {
            utils.JSONError(c, http.StatusBadRequest, "validation error", f.name+" must not be empty")
            return
        }
    }

    // Parse/validate date_of_birth up front so a bad value fails before the tx.
    var newDOB *time.Time
    clearDOB := false
    if payload.DateOfBirth != nil {
        if strings.TrimSpace(*payload.DateOfBirth) == "" {
            clearDOB = true
        } else {
            parsed, err := time.Parse("2006-01-02", *payload.DateOfBirth)
            if err != nil {
                utils.JSONError(c, http.StatusBadRequest, "invalid date_of_birth", "expected format YYYY-MM-DD")
                return
            }
            if y := parsed.Year(); y < 1900 || parsed.After(time.Now()) {
                utils.JSONError(c, http.StatusBadRequest, "invalid date_of_birth", "date is out of the accepted range")
                return
            }
            newDOB = &parsed
        }
    }

    var (
        respUser     models.User
        respStudent  models.Student
        emailChanged bool
    )

    txErr := h.db.Transaction(func(tx *gorm.DB) error {
        var student models.Student
        if err := tx.First(&student, studentID).Error; err != nil {
            return err
        }

        changes := auditChanges{}

        applyStringField(&student.FirstName, payload.FirstName, "first_name", changes)
        applyStringField(&student.LastName, payload.LastName, "last_name", changes)
        applyStringField(&student.Address, payload.Address, "address", changes)
        applyStringField(&student.University, payload.University, "university", changes)
        applyStringField(&student.Faculty, payload.Faculty, "faculty", changes)
        applyStringField(&student.Major, payload.Major, "major", changes)
        applyStringField(&student.Years, payload.Years, "years", changes)
        applyStringField(&student.Skill, payload.Skill, "skill", changes)
        if clearDOB && student.DateOfBirth != nil {
            changes.set("date_of_birth", student.DateOfBirth.Format("2006-01-02"), "")
            student.DateOfBirth = nil
        } else if newDOB != nil {
            old := ""
            if student.DateOfBirth != nil {
                old = student.DateOfBirth.Format("2006-01-02")
            }
            changes.set("date_of_birth", old, newDOB.Format("2006-01-02"))
            student.DateOfBirth = newDOB
        }
        if err := tx.Save(&student).Error; err != nil {
            return err
        }

        var user models.User
        if err := tx.First(&user, student.UserID).Error; err != nil {
            return err
        }
        if payload.Email != nil && *payload.Email != user.Email {
            var n int64
            if err := tx.Model(&models.User{}).Where("email = ? AND user_id <> ?", *payload.Email, user.UserID).Count(&n).Error; err != nil {
                return err
            }
            if n > 0 {
                return conflictError{"email already in use"}
            }
            changes.set("email", user.Email, *payload.Email)
            user.Email = *payload.Email
            emailChanged = true
        }
        applyStringField(&user.Phone, payload.Phone, "phone", changes)
        applyStringField(&user.Gender, payload.Gender, "gender", changes)
        if err := tx.Save(&user).Error; err != nil {
            return err
        }

        if len(changes) > 0 {
            entry := &models.AdminAuditLog{
                AdminID:     &admin.UserID,
                AdminEmail:  adminSnapshotEmail(tx, admin.UserID),
                Action:      "update_student",
                TargetType:  "student",
                TargetID:    student.UserID,
                TargetLabel: strings.TrimSpace(student.FirstName + " " + student.LastName),
                Changes:     changes.json(),
                IPAddress:   c.ClientIP(),
            }
            if err := tx.Create(entry).Error; err != nil {
                return err
            }
        }

        respUser, respStudent = user, student
        return nil
    })
    if txErr != nil {
        h.writeUpdateError(c, txErr)
        return
    }

    if emailChanged {
        notifyUser(h.db, respUser.UserID, "อีเมลบัญชีถูกเปลี่ยนโดยผู้ดูแลระบบ", "account_update",
            "ผู้ดูแลระบบได้เปลี่ยนอีเมลสำหรับเข้าสู่ระบบของบัญชีคุณเป็น "+respUser.Email+" หากคุณไม่ได้ร้องขอ กรุณาติดต่อผู้ดูแลระบบทันที")
    }

    utils.JSONSuccess(c, http.StatusOK, mapStudentToDirectoryResponse(&respUser, &respStudent))
}

// ListAuditLogs returns the admin audit trail, newest first. Optional filters:
// ?target_type=employer|student &target_id=<id> &limit=<1..200> &offset=<n>.
func (h *AdminController) ListAuditLogs(c *gin.Context) {
    limit := 50
    if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 200 {
        limit = v
    }
    offset := 0
    if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
        offset = v
    }

    q := h.db.Model(&models.AdminAuditLog{}).Order("created_at DESC").Limit(limit).Offset(offset)
    if tt := c.Query("target_type"); tt != "" {
        q = q.Where("target_type = ?", tt)
    }
    if tid := c.Query("target_id"); tid != "" {
        if n, err := strconv.ParseUint(tid, 10, 64); err == nil {
            q = q.Where("target_id = ?", uint(n))
        }
    }

    var logs []models.AdminAuditLog
    if err := q.Find(&logs).Error; err != nil {
        log.Printf("list audit logs: %v", err)
        utils.JSONError(c, http.StatusInternalServerError, "failed to load audit logs", "")
        return
    }

    responses := make([]dto.AdminAuditLogResponse, 0, len(logs))
    for i := range logs {
        l := logs[i]
        responses = append(responses, dto.AdminAuditLogResponse{
            ID:          l.ID,
            AdminID:     l.AdminID,
            AdminEmail:  l.AdminEmail,
            Action:      l.Action,
            TargetType:  l.TargetType,
            TargetID:    l.TargetID,
            TargetLabel: l.TargetLabel,
            Changes:     l.Changes,
            CreatedAt:   l.CreatedAt.UTC().Format(time.RFC3339),
        })
    }

    utils.JSONSuccess(c, http.StatusOK, responses)
}

// auditChanges maps a field name to {"from": old, "to": new} for every field
// an admin actually changed in a single edit.
type auditChanges map[string]map[string]string

func (a auditChanges) set(field, from, to string) {
    if from == to {
        return
    }
    a[field] = map[string]string{"from": from, "to": to}
}

func (a auditChanges) json() string {
    if len(a) == 0 {
        return ""
    }
    b, err := json.Marshal(a)
    if err != nil {
        return ""
    }
    return string(b)
}

// applyStringField copies *src into *dst when src is non-nil and the value
// actually differs, recording the change in ch.
func applyStringField(dst *string, src *string, field string, ch auditChanges) {
    if src == nil || *src == *dst {
        return
    }
    ch.set(field, *dst, *src)
    *dst = *src
}

// isBlankPatch reports whether a patch field was supplied but is only
// whitespace — used to reject blanking out columns that must stay non-empty.
func isBlankPatch(p *string) bool {
    return p != nil && strings.TrimSpace(*p) == ""
}

// conflictError is a sentinel returned from inside a tx for uniqueness
// violations we detected ourselves, so writeUpdateError can map it to 409
// without leaking the raw driver error.
type conflictError struct{ msg string }

func (e conflictError) Error() string { return e.msg }

// writeUpdateError translates a transaction error into a safe client response.
// Raw DB errors are logged, never returned.
func (h *AdminController) writeUpdateError(c *gin.Context, err error) {
    var ce conflictError
    switch {
    case errors.As(err, &ce):
        utils.JSONError(c, http.StatusConflict, "update failed", ce.msg)
    case errors.Is(err, gorm.ErrRecordNotFound):
        utils.JSONError(c, http.StatusNotFound, "not found", "the account to update does not exist")
    default:
        log.Printf("admin update failed: %v", err)
        utils.JSONError(c, http.StatusInternalServerError, "update failed", "an unexpected error occurred")
    }
}

// adminSnapshotEmail looks up the acting admin's login email to denormalise
// into the audit row. Best-effort: returns "" if it can't be read.
func adminSnapshotEmail(tx *gorm.DB, adminUserID uint) string {
    var u models.User
    if err := tx.Select("email").First(&u, adminUserID).Error; err != nil {
        return ""
    }
    return u.Email
}

func mapEmployerToDirectoryResponse(user *models.User, employer *models.Employer) dto.EmployerDirectoryResponse {
    return dto.EmployerDirectoryResponse{
        EmployerID:     employer.UserID,
        UserID:         user.UserID,
        Email:          user.Email,
        Phone:          user.Phone,
        Gender:         user.Gender,
        FirstName:      employer.FirstName,
        LastName:       employer.LastName,
        Position:       employer.Position,
        LineID:         employer.LineID,
        CompanyName:    employer.CompanyName,
        BusinessType:   employer.BusinessType,
        TaxID:          employer.TaxID,
        Link:           employer.Link,
        CompanyAddress: employer.CompanyAddress,
    }
}

func mapStudentToDirectoryResponse(user *models.User, student *models.Student) dto.StudentDirectoryResponse {
    dateOfBirth := ""
    if student.DateOfBirth != nil {
        dateOfBirth = student.DateOfBirth.Format("2006-01-02")
    }
    return dto.StudentDirectoryResponse{
        StudentID:   student.UserID,
        UserID:      user.UserID,
        Email:       user.Email,
        Phone:       user.Phone,
        Gender:      user.Gender,
        FirstName:   student.FirstName,
        LastName:    student.LastName,
        DateOfBirth: dateOfBirth,
        Address:     student.Address,
        University:  student.University,
        Faculty:     student.Faculty,
        Major:       student.Major,
        Years:       student.Years,
        Skill:       student.Skill,
    }
}
