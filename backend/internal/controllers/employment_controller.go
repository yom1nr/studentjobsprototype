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

// ═══════════════════════════════════════════════════════════════════════════════
// [B6733827] ระบบย่อยที่ 2 : ระบบตกลงการจ้างงาน (Employment Agreement)
//
// ไฟล์นี้คือ lifeline ":EmploymentController" ใน Sequence Diagram 2
//
//	หน้า React (pages/employment/index.tsx) ──HTTP──► handler ในไฟล์นี้
//	──► ตรวจสิทธิ์ ──► ตรวจกฎธุรกิจ ──► ตาราง employment_agreements ──► แจ้งเตือน U4
//
// Use Case ที่ไฟล์นี้รองรับ
//
//	U6 Create Employment Agreement          → CreateAgreement (+ DeleteAgreement)
//	U7 Accept / Reject Employment Agreement → Accept, Reject
//	U8 View History / Past Agreements       → ListMine (ตัวเอง) · ListAll (แอดมิน/University Staff)
//	U4 Send Notifications                   → notifyUser
//
// จุดเชื่อมกับระบบย่อยที่ 1 : รับ interview_id ที่ Result == "passed" เท่านั้น
//
//	(Use Case: U6 «extend» U5  /  Class Diagram: InterviewSchedule 1 ── 0..1 Agreement)
//
// จุดเชื่อมกับระบบเพื่อน : status="accepted" = เริ่มบันทึกเวลาทำงาน, Payroll อ้าง AgreementID
//
// วงจรสถานะ EmploymentAgreement.Status
//
//	pending ─(นศ.ตกลง U7)─► accepted "มีผลบังคับ"
//	        ─(นศ.ปฏิเสธ U7)─► rejected ─(ผู้ประกอบการลบ)─► void (soft delete)
//
// ═══════════════════════════════════════════════════════════════════════════════
// EmploymentController manages employment agreements between employers and students (B6733827 subsystem 2).
type EmploymentController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewEmploymentController creates a new EmploymentController.
func NewEmploymentController(db *gorm.DB) *EmploymentController {
	return &EmploymentController{db: db, validate: validator.New()}
}

// ── กฎ "1 สัญญาที่มีผล ต่อ 1 คู่ (นศ., ผู้ประกอบการ)" ──────────────────────────────────
// active = pending (รอตอบ) หรือ accepted ที่ยังไม่หมดอายุ (start_date + duration_months)
// ใช้ทั้งที่นี่ (CreateAgreement) และที่ ApplicationController.CreateApplication
// (นศ. สมัครซ้ำผู้ประกอบการเดิมไม่ได้จนสัญญาหมด แต่สมัครที่อื่นได้)
// activeAgreementFor reports the contract currently binding this student to this
// employer, if any. "Currently" means a draft still awaiting the student's answer,
// or an accepted contract whose term has not run out — its start date plus its
// duration in months.
//
// A contract with no start date or no duration has no end that can be computed,
// so it counts as still running: treating it as expired would quietly let a second
// contract be signed on top of a live one.
func activeAgreementFor(db *gorm.DB, studentID, employerID uint) (*models.EmploymentAgreement, bool, error) {
	var agreements []models.EmploymentAgreement
	if err := db.Where("student_id = ? AND employer_id = ? AND status IN ?",
		studentID, employerID, []string{"pending", "accepted"}).Find(&agreements).Error; err != nil {
		// Fail closed: a query error must not be read as "no active contract"
		// and let a second one through.
		return nil, false, err
	}
	now := time.Now().UTC()
	for i := range agreements {
		a := &agreements[i]
		if a.Status == "pending" || a.StartDate == nil || a.DurationMonths <= 0 {
			return a, true, nil
		}
		if a.StartDate.AddDate(0, a.DurationMonths, 0).After(now) {
			return a, true, nil
		}
	}
	return nil, false, nil
}

// agreementEndText renders when a contract runs out, for messages that tell
// someone to wait for it. Empty when there is no computable end date.
func agreementEndText(a *models.EmploymentAgreement) string {
	if a == nil || a.StartDate == nil || a.DurationMonths <= 0 {
		return ""
	}
	return a.StartDate.UTC().AddDate(0, a.DurationMonths, 0).Format("2006-01-02")
}

// ┌─ [U6] POST /api/v1/employer/agreements ─ ผู้ประกอบการจัดทำข้อตกลง ─────────────────┐
// │ Activity Diagram 2: "Select student + fill in the employment agreement form (U6)"  │
// │   → "Agreement terms complete?" → "Save status Pending response + send (U4)"      │
// │ รับ interview_id (ไม่ใช่ student_id) → นศ. และตำแหน่งงานตามมาจากนัดสัมภาษณ์          │
// │ กฎที่บังคับตามลำดับ:                                                                │
// │   1. นัดเป็นของเรา + Result == "passed"        (ประตูจากระบบย่อยที่ 1)              │
// │   2. 1 นัด = 1 ข้อตกลง (ไม่นับ void)            (Class Diagram 1 ── 0..1)             │
// │      ปฏิเสธแล้ว → ตำแหน่งนี้ปิดสำหรับ นศ. คนนี้ จนกว่าผู้ประกอบการจะลบ record ที่ปฏิเสธ │
// │   3. นศ. ไม่มีสัญญา active กับเราอยู่ก่อน       (activeAgreementFor)                 │
// │ สร้าง status="pending" แล้วแจ้ง นศ. (U4)                                             │
// └────────────────────────────────────────────────────────────────────────────────────┘
// CreateAgreement drafts and sends an employment agreement to a student.
func (h *EmploymentController) CreateAgreement(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	var payload dto.CreateAgreementRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	// The interview is the anchor: it proves the candidate got through this
	// employer's process, and it carries the position the contract is for.
	// ขั้น 3: หานัดสัมภาษณ์ที่อ้างถึง — ต้องเป็นของผู้ประกอบการคนนี้ (WHERE employer_id) ไม่ใช่ → 404
	var passedInterview models.InterviewSchedule
	if err := h.db.Where("interview_id = ? AND employer_id = ?", payload.InterviewID, employer.UserID).
		First(&passedInterview).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview of yours exists with the given id")
		return
	}
	// ขั้น 4 (ประตูจากระบบย่อยที่ 1): ผลสัมภาษณ์ต้องเป็น passed เท่านั้น
	if passedInterview.Result != "passed" {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "announce a passing interview result before sending an employment agreement")
		return
	}

	var student models.Student
	if err := h.db.First(&student, passedInterview.StudentID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "student not found", "no student exists for this interview")
		return
	}

	// One offer per interview, whatever became of it. A student who turned an
	// offer down has answered for this position — re-sending it would let an
	// employer put the same declined terms back in front of them repeatedly.
	// Voiding the declined record (DeleteAgreement) is what frees the
	// candidate up again — void rows are excluded here since that's the point.
	// ขั้น 5: นัดนี้เคยมีข้อตกลง (ที่ไม่ใช่ void) แล้วหรือยัง — ถ้าถูกปฏิเสธไป บอกให้ไปลบตัวนั้นก่อน
	var prior models.EmploymentAgreement
	err := h.db.Where("interview_schedule_id = ? AND status <> ?", passedInterview.InterviewID, "void").First(&prior).Error
	if err == nil {
		detail := "an employment agreement has already been sent for this interview"
		if prior.Status == "rejected" {
			detail = "this student declined the agreement for this interview — delete the declined record first if you want to offer again"
		}
		utils.JSONError(c, http.StatusBadRequest, "create failed", detail)
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	// A student works under one contract per employer at a time. A second one
	// while the first is still running would leave two live sets of terms — wages,
	// hours, end date — for the same job relationship.
	// ขั้น 6: นศ. คนนี้มีสัญญา active กับเราอยู่แล้วไหม (ถ้ามี บอกวันหมดสัญญาใน error)
	live, busy, err := activeAgreementFor(h.db, student.UserID, employer.UserID)
	if err != nil {
		utils.JSONInternalError(c, "create failed", err)
		return
	}
	if busy {
		detail := "this student is already under contract with you"
		if end := agreementEndText(live); end != "" {
			detail += " until " + end
		}
		utils.JSONError(c, http.StatusBadRequest, "create failed", detail)
		return
	}

	// ขั้น 7: แปลงวันเริ่มงาน
	start, err := time.Parse("2006-01-02", payload.StartDate)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid start_date", "expected format YYYY-MM-DD")
		return
	}

	// ขั้น 8: สร้างแถว employment_agreements status=pending — StudentID เอาจากนัด ไม่รับจาก client (กันสวมรอย)
	interviewID := passedInterview.InterviewID
	agreement := &models.EmploymentAgreement{
		StudentID:           student.UserID,
		EmployerID:          employer.UserID,
		InterviewScheduleID: &interviewID,
		StartDate:           &start,
		WageRate:            payload.WageRate,
		DurationMonths:      payload.DurationMonths,
		WorkingHours:        payload.WorkingHours,
		LeavePolicy:         payload.LeavePolicy,
		AdditionalTerms:     payload.AdditionalTerms,
		Status:              "pending",
	}
	if err := h.db.Create(agreement).Error; err != nil {
		// The prior-agreement check above is read-then-write; a second request for
		// the same interview arriving in the gap between that check and this
		// insert lands here instead of both succeeding — the partial unique index
		// on (interview_schedule_id) is the actual guarantee, this check is just
		// the common-case fast path with a friendlier message.
		if utils.IsUniqueViolation(err) {
			utils.JSONError(c, http.StatusConflict, "create failed", "an employment agreement has already been sent for this interview")
			return
		}
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	// ขั้น 9: แจ้งนักศึกษา (U4) → ไปตอบที่หน้า "แจ้งผลการจ้างงาน" (U7)
	notifyUser(h.db, student.UserID, "ข้อตกลงการจ้างงานใหม่", "employment_agreement",
		fmt.Sprintf("%s ส่งข้อตกลงการจ้างงานให้คุณตรวจสอบ กรุณาตอบรับหรือปฏิเสธ", employer.CompanyName))

	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(agreement, employer.CompanyName, h.studentName(student.UserID)))
}

// ┌─ DELETE /api/v1/employer/agreements/:id ─ ลบข้อตกลงที่ถูกปฏิเสธ (soft delete) ───────┐
// │ ลบได้เฉพาะ status="rejected" และไม่มี payroll อ้างอยู่                                │
// │ ไม่ลบแถวจริง แต่เปลี่ยน status → "void" เก็บหลักฐานว่าเคยเสนออะไร/ถูกปฏิเสธเพราะอะไร │
// │ ผล: interview นั้นกลับมาเสนอข้อตกลงใหม่ได้ (เพราะ CreateAgreement ไม่นับ void)        │
// └────────────────────────────────────────────────────────────────────────────────────┘
// DeleteAgreement clears a declined offer out of the employer's active
// records so the same interview can be offered a fresh contract (#10).
//
// Only rejected drafts can go: a pending one is still awaiting the student's
// answer, and an accepted one is a contract in force that time records and
// payroll are billed against. This is a soft delete — Status flips to "void"
// rather than removing the row — so what was offered and why the student
// turned it down stays on file if it's ever needed (a dispute, an audit); it
// is just excluded from ListMine and from the "one offer per interview"
// check, which is what actually frees the interview up to be offered again.
func (h *EmploymentController) DeleteAgreement(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid agreement id", "id must be a number")
		return
	}

	var agreement models.EmploymentAgreement
	if err := h.db.Where("agreement_id = ? AND employer_id = ?", id, employer.UserID).First(&agreement).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "agreement not found", "no agreement of yours exists with the given id")
		return
	}
	// ลบได้เฉพาะที่ถูกปฏิเสธ — pending ยังรอตอบ / accepted คือสัญญาที่มีผล
	if agreement.Status != "rejected" {
		utils.JSONError(c, http.StatusBadRequest, "delete failed", "only an agreement the student declined can be deleted")
		return
	}

	// มี payroll (ระบบเพื่อน) อ้างอยู่ → ห้ามลบ ไม่งั้นข้อมูลเงินเดือนลอย
	var payrolls int64
	if err := h.db.Model(&models.Payroll{}).Where("agreement_id = ?", agreement.AgreementID).Count(&payrolls).Error; err != nil {
		utils.JSONInternalError(c, "delete failed", err)
		return
	}
	if payrolls > 0 {
		utils.JSONError(c, http.StatusBadRequest, "delete failed", "this agreement has payroll records attached")
		return
	}

	// soft delete: เปลี่ยน status เป็น void แทน DELETE — เก็บหลักฐานไว้
	if err := h.db.Model(&agreement).Update("status", "void").Error; err != nil {
		utils.JSONInternalError(c, "delete failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"deleted": true})
}

// [U8] GET /api/v1/agreements — ดูข้อตกลงของตัวเอง แยกตาม role จาก JWT (ซ่อน void)
// Sequence Diagram 2 ข้อ 2–5: getAgreement → findByID → agreement → agreementDetail
// ListMine returns agreements scoped to the current user's role.
func (h *EmploymentController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	role, _ := utils.GetUserRoleFromContext(c)
	var agreements []models.EmploymentAgreement

	if role == "employer" {
		employer, ok := h.currentEmployer(c)
		if !ok {
			return
		}
		// Voided offers (#10) are cleared drafts, not something either party
		// still needs to see in their list.
		// ผู้ประกอบการ: เฉพาะที่ตัวเองสร้าง + ซ่อน void
		if err := h.db.Where("employer_id = ? AND status <> ?", employer.UserID, "void").Order("created_at DESC").Find(&agreements).Error; err != nil {
			utils.JSONInternalError(c, "failed to load agreements", err)
			return
		}
		responses := make([]dto.AgreementResponse, 0, len(agreements))
		for i := range agreements {
			responses = append(responses, h.mapToResponse(&agreements[i], employer.CompanyName, h.studentName(agreements[i].StudentID)))
		}
		utils.JSONSuccess(c, http.StatusOK, responses)
		return
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}
	// นักศึกษา: เฉพาะที่ตัวเองเป็นคู่สัญญา + ซ่อน void ← ทางแยก "Access allowed?" ของ U8
	if err := h.db.Where("student_id = ? AND status <> ?", student.UserID, "void").Order("created_at DESC").Find(&agreements).Error; err != nil {
		utils.JSONInternalError(c, "failed to load agreements", err)
		return
	}
	responses := make([]dto.AgreementResponse, 0, len(agreements))
	for i := range agreements {
		responses = append(responses, h.mapToResponse(&agreements[i], h.companyName(agreements[i].EmployerID), h.studentName(student.UserID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ┌─ [U8] GET /api/v1/admin/agreements ─ เจ้าหน้าที่มหาวิทยาลัยดูข้อตกลงทั้งระบบ ───────────┐
// │ actor "University Staff" ของ U8 — อ่านอย่างเดียว เห็นทุกสถานะรวม void (เพื่อการตรวจสอบ) │
// │ สิทธิ์: jwtAuth + RequireRole("admin") ที่ route group /admin                            │
// └────────────────────────────────────────────────────────────────────────────────────┘
// ListAll returns every agreement for the university staff's read-only history view.
// Void rows are kept here — they are the audit trail of offers that were declined
// and then cleared, which is exactly what a mediator may need to see.
func (h *EmploymentController) ListAll(c *gin.Context) {
	var agreements []models.EmploymentAgreement
	if err := h.db.Order("created_at DESC").Find(&agreements).Error; err != nil {
		utils.JSONInternalError(c, "failed to load agreements", err)
		return
	}
	responses := make([]dto.AgreementResponse, 0, len(agreements))
	for i := range agreements {
		a := &agreements[i]
		responses = append(responses, h.mapToResponse(a, h.companyName(a.EmployerID), h.studentName(a.StudentID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ┌─ [U7] POST /api/v1/student/agreements/:id/accept ─ นศ. ตกลงข้อตกลง ────────────────┐
// │ Sequence Diagram 2  alt [Student accepts]  ข้อ 8–13                                 │
// │   8  acceptAgreement(agreementID)   ← เข้าฟังก์ชันนี้                               │
// │   9  verifyOwner(studentID)         → ownedByCurrentStudent (ไม่ใช่เจ้าของ → 404)   │
// │   10 setStatus("accepted")          → agreement.Status = "accepted"                 │
// │   11 update(agreement)              → h.db.Save                                     │
// │   12 notifyEmployer("accepted")     → notifyUser(... "มีผลบังคับ")                  │
// │   13 success("In effect")           → JSONSuccess 200                               │
// │ กฎ: ตอบได้เฉพาะ pending (ตัดสินแล้วตอบซ้ำไม่ได้)                                     │
// │ ผลต่อระบบอื่น: accepted = "งานของฉัน" แสดง / ระบบบันทึกเวลาเริ่มใช้ได้                │
// └────────────────────────────────────────────────────────────────────────────────────┘
// Accept lets the student accept a pending agreement.
func (h *EmploymentController) Accept(c *gin.Context) {
	agreement, employer, ok := h.ownedByCurrentStudent(c)
	if !ok {
		return
	}
	if agreement.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this agreement has already been decided")
		return
	}

	// Sequence ข้อ 10–11: setStatus("accepted") → update(agreement)
	agreement.Status = "accepted"
	if err := h.db.Save(agreement).Error; err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	// Sequence ข้อ 12: notifyEmployer — ข้อความบอกว่า "มีผลบังคับ" (U4)
	notifyUser(h.db, employer.UserID, "นักศึกษาตอบรับข้อตกลงการจ้างงาน", "employment_agreement",
		fmt.Sprintf("ข้อตกลง AG-%d เปลี่ยนสถานะเป็น \"มีผลบังคับ\"", agreement.AgreementID))

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(agreement, employer.CompanyName, h.studentName(agreement.StudentID)))
}

// ┌─ [U7] POST /api/v1/student/agreements/:id/reject ─ นศ. ปฏิเสธพร้อมเหตุผล ──────────┐
// │ Sequence Diagram 2  alt [Student rejects] → alt [Reason specified]  ข้อ 18–22        │
// │   18 rejectAgreement(agreementID, reason)                                           │
// │      reason บังคับกรอก — UI เช็ค (18.1) และ backend เช็คซ้ำด้วย validate.Struct      │
// │   19 setStatus("rejected"), setRejectReason(reason)                                 │
// │   20 update(agreement)   21 notifyEmployer(... เหตุผล)   22 success                 │
// │ เหตุผลถูกเก็บใน reject_reason → ผู้ประกอบการเห็นในหน้าประวัติ (โปร่งใสทั้ง 2 ฝั่ง)     │
// └────────────────────────────────────────────────────────────────────────────────────┘
// Reject lets the student decline a pending agreement with a reason.
func (h *EmploymentController) Reject(c *gin.Context) {
	agreement, employer, ok := h.ownedByCurrentStudent(c)
	if !ok {
		return
	}
	if agreement.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this agreement has already been decided")
		return
	}

	// เหตุผลบังคับกรอก — backend validate อีกชั้นแม้ UI เช็คแล้ว (= Sequence 18.1)
	var payload dto.RejectAgreementRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	// Sequence ข้อ 19–20: setStatus("rejected") + setRejectReason → update
	agreement.Status = "rejected"
	agreement.RejectReason = payload.Reason
	if err := h.db.Save(agreement).Error; err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	// Sequence ข้อ 21: notifyEmployer พร้อมเหตุผล (U4) → ผู้ประกอบการเห็นในประวัติ
	notifyUser(h.db, employer.UserID, "นักศึกษาปฏิเสธข้อตกลงการจ้างงาน", "employment_agreement",
		fmt.Sprintf("ข้อตกลง AG-%d ถูกปฏิเสธ: %s", agreement.AgreementID, payload.Reason))

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(agreement, employer.CompanyName, h.studentName(agreement.StudentID)))
}

// ── helper ตรวจสิทธิ์ ──────────────────────────────────────────────────────────────────
//
//	currentEmployer        : user จาก JWT ต้องมีโปรไฟล์ Employer
//	ownedByCurrentStudent  : ข้อตกลง :id ต้องเป็นของ นศ. ที่ล็อกอิน (= "verifyOwner" ใน Sequence)
func (h *EmploymentController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
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
			utils.JSONInternalError(c, "action failed", err)
		}
		return nil, false
	}
	return &employer, true
}

func (h *EmploymentController) ownedByCurrentStudent(c *gin.Context) (*models.EmploymentAgreement, *models.Employer, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, nil, false
	}
	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return nil, nil, false
	}

	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid agreement id", "id must be a number")
		return nil, nil, false
	}
	var agreement models.EmploymentAgreement
	if err := h.db.Where("agreement_id = ? AND student_id = ?", id, student.UserID).First(&agreement).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "agreement not found", "no agreement exists with the given id")
		return nil, nil, false
	}

	var employer models.Employer
	h.db.First(&employer, agreement.EmployerID)

	return &agreement, &employer, true
}

func (h *EmploymentController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *EmploymentController) companyName(employerID uint) string {
	var employer models.Employer
	if err := h.db.Select("company_name").First(&employer, employerID).Error; err != nil {
		return ""
	}
	return employer.CompanyName
}

func (h *EmploymentController) mapToResponse(a *models.EmploymentAgreement, companyName, studentName string) dto.AgreementResponse {
	startDate := ""
	if a.StartDate != nil {
		startDate = a.StartDate.Format("2006-01-02")
	}
	return dto.AgreementResponse{
		ID:                  a.AgreementID,
		InterviewScheduleID: a.InterviewScheduleID,
		StudentID:           a.StudentID,
		StudentName:         studentName,
		EmployerID:          a.EmployerID,
		CompanyName:         companyName,
		StartDate:           startDate,
		WageRate:            a.WageRate,
		DurationMonths:      a.DurationMonths,
		WorkingHours:        a.WorkingHours,
		LeavePolicy:         a.LeavePolicy,
		AdditionalTerms:     a.AdditionalTerms,
		Status:              a.Status,
		RejectReason:        a.RejectReason,
		CreatedAt:           a.CreatedAt.Format(time.RFC3339),
	}
}
