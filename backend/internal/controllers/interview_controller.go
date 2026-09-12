package controllers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/dto"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// ═══════════════════════════════════════════════════════════════════════════════
// [B6733827] ระบบย่อยที่ 1 : ระบบจัดการนัดหมายสัมภาษณ์ (Interview Appointment)
//
// ไฟล์นี้คือ lifeline ":InterviewController" ใน Sequence Diagram
//
//	หน้า React (pages/interviews/index.tsx) ──HTTP──► handler ในไฟล์นี้
//	──► ตรวจสิทธิ์ (JWT/role/เจ้าของ) ──► ตรวจกฎธุรกิจ ──► เขียนตารางผ่าน GORM
//	──► ส่งแจ้งเตือน U4 (notifyAboutInterview / notifyAboutReschedule ท้ายไฟล์)
//
// Use Case ที่ไฟล์นี้รองรับ  (ดู Use Case Diagram หัวข้อ 4.3)
//
//	U1 Schedule Interview Appointment      → CreateInterview, UpdateInterview
//	U2 Confirm Appointment Acknowledgement → ConfirmAttendance
//	U3 Reschedule Interview                → RequestReschedule (นศ. เสนอ 1 เวลา)
//	                                         OfferRescheduleSlots (ผู้ประกอบการเสนอ ≤5 เวลา)
//	                                         ApproveReschedule / RejectReschedule (ผู้ประกอบการตอบ)
//	                                         SelectRescheduleSlot (นศ. เลือก)
//	U4 Send Notifications                  → notifyAboutInterview / notifyAboutReschedule
//	U5 Notify Applicant Screening Result   → SendResult
//	U8 View History                        → ListMine, ListReschedules (ตัวเอง) · ListAll (แอดมิน/University Staff)
//
// ตารางที่เขียน (Class Diagram หัวข้อ 7)
//
//	interview_schedules ─1..*─ reschedule_interviews ─1..*─ reschedule_proposed_slots
//	interview_schedules ─1..*─ notifications
//
// วงจรสถานะ InterviewSchedule.Status
//
//	pending ─(นศ.ยืนยัน U2)─► confirmed ─(มีคำขอเลื่อน U3)─► rescheduling ─(ตอบคำขอ)─► confirmed
//	─(ประกาศผล U5)─► completed          หรือ  cancelled
//
// ═══════════════════════════════════════════════════════════════════════════════
// InterviewController manages interview scheduling between employers and students (B6733827 subsystem 1).
type InterviewController struct {
	db       *gorm.DB
	validate *validator.Validate
}

// NewInterviewController creates a new InterviewController.
func NewInterviewController(db *gorm.DB) *InterviewController {
	return &InterviewController{db: db, validate: validator.New()}
}

// ┌─ [U1] POST /api/v1/employer/interviews ─ ผู้ประกอบการสร้างนัดสัมภาษณ์ ────────────┐
// │ ตรงกับ Sequence Diagram 1 (หัวข้อ 8.3) ข้อ 4–13                                  │
// │   4    createInterview(interviewData)  ← request เข้าฟังก์ชันนี้                  │
// │   5    validate(interviewData)         → ShouldBindJSON + validate.Struct         │
// │   5.1  error("fill in all required")   → 400 ถ้าไม่ครบ                            │
// │   6–7  checkApplication(applicationID) → ใบสมัครเป็นของเรา + accepted + ยังไม่มีนัด │
// │   7.1  error("already has an interview")→ 400                                     │
// │   8–10 create(status="pending") + save → h.db.Create(interview)                    │
// │   11–12 notifyStudent + saveNotification → notifyUser(...)                         │
// │   13   success(interviewSchedule)      → JSONSuccess 201                          │
// │ กฎ: 1 ใบสมัคร = 1 นัด  (Class Diagram: Application 1 ── 0..1 InterviewSchedule)    │
// └────────────────────────────────────────────────────────────────────────────────────┘
// CreateInterview schedules a new interview appointment for a student.
func (h *InterviewController) CreateInterview(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}

	// ขั้น 1 ผ่านแล้ว (currentEmployer = ผู้เรียกเป็นผู้ประกอบการ) → ขั้น 2: อ่าน JSON → DTO แล้ว validate ช่องบังคับ
	var payload dto.CreateInterviewRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	// The application is the anchor: it proves the student applied to a post of
	// yours and that you accepted them, so the flow apply → accept → interview
	// can't be skipped, and it says which position the appointment is for.
	// ขั้น 3: หาใบสมัคร — ต้องเป็นใบสมัครของประกาศงาน "ของเรา" (subquery jobposts.user_id = employer) ไม่ใช่ → 404
	var application models.Application
	err := h.db.Where("application_id = ? AND jobpost_id IN (?)", payload.ApplicationID,
		h.db.Model(&models.Jobpost{}).Select("jobpost_id").Where("user_id = ?", employer.UserID)).
		First(&application).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.JSONError(c, http.StatusNotFound, "application not found", "no application of yours exists with the given id")
		} else {
			utils.JSONInternalError(c, "create failed", err)
		}
		return
	}
	// กฎลำดับงาน (Activity Diagram): สมัคร → ผ่านคัดเลือก → *ค่อย* นัดสัมภาษณ์ — ข้ามขั้นไม่ได้
	if application.Status != "accepted" {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "accept this application before scheduling an interview for it")
		return
	}

	// ขั้น 4: ดึงนักศึกษาเจ้าของใบสมัคร (เอา id ไปใส่นัด + ส่งแจ้งเตือน)
	var student models.Student
	if err := h.db.First(&student, application.StudentID).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "student not found", "no student exists for this application")
		return
	}

	// Declining an offer closes that position for this student, not every position
	// they applied for — so nothing extra is checked here. The one-interview-per-
	// application rule below already stops the declined application itself from
	// being scheduled again.

	// Sequence ข้อ 6–7 + opt 7.1 : ใบสมัครนี้มีนัดค้างอยู่แล้วหรือยัง (ไม่นับที่ cancelled)
	// One live appointment per application — the UI shows a single appointment
	// per application row, so a second would silently become unreachable.
	var existing models.InterviewSchedule
	err = h.db.Where("application_id = ? AND status <> ?", application.ApplicationID, "cancelled").
		First(&existing).Error
	if err == nil {
		utils.JSONError(c, http.StatusBadRequest, "create failed", "this application already has an interview — edit that appointment instead")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	// ขั้น 6: แปลงวัน "YYYY-MM-DD" + เวลา "HH:MM" เป็นรูปแบบกลาง (ผิด format → 400)
	date, canonicalTime, err := parseAppointmentDateTime(payload.AppointmentDate, payload.AppointmentTime)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}

	// ขั้น 7: สร้างแถว interview_schedules — status ไม่ต้องใส่ ได้ default "pending" จาก struct tag  (= Sequence ข้อ 8–10)
	applicationID := application.ApplicationID
	interview := &models.InterviewSchedule{
		ApplicationID:      &applicationID,
		StudentID:          student.UserID,
		EmployerID:         employer.UserID,
		InterviewFormat:    payload.InterviewFormat,
		AppointmentTime:    canonicalTime,
		AppointmentDate:    &date,
		Location:           payload.Location,
		PreparationDetails: payload.PreparationDetails,
	}
	if err := h.db.Create(interview).Error; err != nil {
		utils.JSONInternalError(c, "create failed", err)
		return
	}

	// ขั้น 8: แจ้งนักศึกษา (U4) → แถวใหม่ในตาราง notifications  (= Sequence ข้อ 11–12)
	notifyUser(h.db, student.UserID, "นัดหมายสัมภาษณ์ใหม่", "interview_scheduled",
		fmt.Sprintf("%s นัดสัมภาษณ์คุณวันที่ %s เวลา %s น.", employer.CompanyName, payload.AppointmentDate, payload.AppointmentTime))

	// ขั้น 9: ตอบ 201 + ข้อมูลนัดในรูป DTO  (= Sequence ข้อ 13)
	utils.JSONSuccess(c, http.StatusCreated, h.mapToResponse(interview, employer.CompanyName, h.studentName(student.UserID)))
}

// ┌─ [U8] GET /api/v1/interviews ─ ดูนัดของตัวเอง ────────────────────────────────────┐
// │ endpoint เดียว ใช้ได้ทั้ง 2 role — อ่าน role จาก JWT แล้วกรองคนละเงื่อนไข            │
// │ Preload("Reschedules.ProposedSlots") = GORM โหลด has-many 2 ชั้นมาพร้อมกัน        │
// │ (ประวัติเลื่อนนัด + เวลาที่เสนอ) ไม่ต้อง query ทีละแถว (กัน N+1)                    │
// └────────────────────────────────────────────────────────────────────────────────────┘
// ListMine returns interviews scoped to the current user's role (employer sees ones
// they created, student sees ones scheduled for them).
func (h *InterviewController) ListMine(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}

	// role อ่านจาก JWT ที่ backend ออกให้เอง — client ปลอมไม่ได้
	role, _ := utils.GetUserRoleFromContext(c)
	var interviews []models.InterviewSchedule

	if role == "employer" {
		employer, ok := h.currentEmployer(c)
		if !ok {
			return
		}
		// ผู้ประกอบการ: เห็นเฉพาะนัดที่ตัวเองสร้าง (WHERE employer_id = ตัวเอง)
		if err := h.db.Preload("Reschedules.ProposedSlots").Where("employer_id = ?", employer.UserID).Order("created_at DESC").Find(&interviews).Error; err != nil {
			utils.JSONInternalError(c, "failed to load interviews", err)
			return
		}
		responses := make([]dto.InterviewResponse, 0, len(interviews))
		for i := range interviews {
			responses = append(responses, h.mapToResponse(&interviews[i], employer.CompanyName, h.studentName(interviews[i].StudentID)))
		}
		utils.JSONSuccess(c, http.StatusOK, responses)
		return
	}

	var student models.Student
	if err := h.db.Where("user_id = ?", userID).First(&student).Error; err != nil {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "submit your profile first")
		return
	}
	// นักศึกษา: เห็นเฉพาะนัดของตัวเอง (WHERE student_id = ตัวเอง) ← นี่คือทางแยก "Access allowed?" ของ U8 ในโค้ด
	if err := h.db.Preload("Reschedules.ProposedSlots").Where("student_id = ?", student.UserID).Order("created_at DESC").Find(&interviews).Error; err != nil {
		utils.JSONInternalError(c, "failed to load interviews", err)
		return
	}
	responses := make([]dto.InterviewResponse, 0, len(interviews))
	for i := range interviews {
		responses = append(responses, h.mapToResponse(&interviews[i], h.companyName(interviews[i].EmployerID), h.studentName(student.UserID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ┌─ [U8] GET /api/v1/admin/interviews ─ เจ้าหน้าที่มหาวิทยาลัยดูนัดสัมภาษณ์ทั้งระบบ ─────────┐
// │ Use Case U8 มี actor "University Staff" ด้วย — endpoint นี้คือทางเข้าของ actor นั้น       │
// │ อ่านอย่างเดียว (ไม่มี POST/PUT ฝั่งแอดมิน) และเห็นทุกคน ไม่กรองด้วย employer/student  │
// │ สิทธิ์: jwtAuth + RequireRole("admin") ที่ route group /admin                            │
// └────────────────────────────────────────────────────────────────────────────────────┘
// ListAll returns every interview in the system with its reschedule history — the
// read-only view the university staff use to audit or mediate. Unlike ListMine it
// is not scoped to the caller, which is why it lives behind the admin role.
func (h *InterviewController) ListAll(c *gin.Context) {
	var interviews []models.InterviewSchedule
	if err := h.db.Preload("Reschedules.ProposedSlots").Order("created_at DESC").Find(&interviews).Error; err != nil {
		utils.JSONInternalError(c, "failed to load interviews", err)
		return
	}
	responses := make([]dto.InterviewResponse, 0, len(interviews))
	for i := range interviews {
		iv := &interviews[i]
		responses = append(responses, h.mapToResponse(iv, h.companyName(iv.EmployerID), h.studentName(iv.StudentID)))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ┌─ [U1] PUT /api/v1/employer/interviews/:id ─ แก้รายละเอียดนัด ───────────────────────┐
// │ ownedByEmployer = ต้องเป็นนัดของตัวเอง (กัน IDOR)                                   │
// │ กฎ: ประกาศผลแล้ว / ยกเลิกแล้ว → แก้ไม่ได้  ← เช็คที่ backend ไม่ใช่แค่ล็อกปุ่มใน UI │
// │ (เคยพิสูจน์ด้วย curl ว่า UI ล็อกอย่างเดียวข้ามได้ จึงเพิ่ม guard นี้)                 │
// └────────────────────────────────────────────────────────────────────────────────────┘
// UpdateInterview lets the employer edit an interview's appointment details.
func (h *InterviewController) UpdateInterview(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}
	// A finished appointment is a record of what happened, not a plan — moving it
	// after the result is out would rewrite history and contradict what the
	// student was already told.
	if interview.Status == "completed" || interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "this interview is already finished")
		return
	}
	if interview.Status == "cancelled" {
		utils.JSONError(c, http.StatusBadRequest, "update failed", "this interview has been cancelled")
		return
	}

	var payload dto.UpdateInterviewRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}
	date, canonicalTime, err := parseAppointmentDateTime(payload.AppointmentDate, payload.AppointmentTime)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}

	// เขียนผ่าน setAppointment ตัวเดียวทั้งระบบ → appointment_date/time มีรูปแบบเดียวไม่ว่าใครแก้
	if err := setAppointment(h.db, interview.InterviewID, date, canonicalTime, map[string]any{
		"interview_format":    payload.InterviewFormat,
		"location":            payload.Location,
		"preparation_details": payload.PreparationDetails,
	}); err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}
	if err := h.db.First(interview, interview.InterviewID).Error; err != nil {
		utils.JSONInternalError(c, "update failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, h.mapToResponse(interview, employer.CompanyName, h.studentName(interview.StudentID)))
}

// utcInstant parses an RFC3339 timestamp and requires a UTC offset ("Z" or
// "+00:00"). Reschedule times are stored and shown as their literal wall-clock
// digits with no zone conversion, so a value carrying a real offset —
// 13:30+07:00 — would be saved as 06:30 and read back as the wrong time by
// everyone. Rejecting it here keeps that convention enforced, not assumed.
// รับเฉพาะ RFC3339 ที่เป็น UTC (ลงท้าย Z) — ถ้ามาเป็น +07:00 ปฏิเสธ ไม่งั้นเวลาจะเพี้ยน 7 ชม. ตอนแสดง
func utcInstant(raw string) (time.Time, bool) {
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, false
	}
	if _, offset := t.Zone(); offset != 0 {
		return time.Time{}, false
	}
	return t.UTC(), true
}

// deleteReschedulesForInterviews removes every RescheduleInterview row (and
// its RescheduleProposedSlot children) for the given interviews. Used by the
// application/jobpost delete flows that cascade through InterviewSchedule
// rows — DisableForeignKeyConstraintWhenMigrating means nothing does this for
// free at the database level, so each cascade has to do it explicitly.
func deleteReschedulesForInterviews(tx *gorm.DB, interviewIDs []uint) error {
	var rescheduleIDs []uint
	if err := tx.Model(&models.RescheduleInterview{}).Where("interview_schedule_id IN ?", interviewIDs).
		Pluck("reschedule_id", &rescheduleIDs).Error; err != nil {
		return err
	}
	if len(rescheduleIDs) > 0 {
		if err := tx.Where("reschedule_interview_id IN ?", rescheduleIDs).Delete(&models.RescheduleProposedSlot{}).Error; err != nil {
			return err
		}
	}
	return tx.Where("interview_schedule_id IN ?", interviewIDs).Delete(&models.RescheduleInterview{}).Error
}

// openReschedulePending reports whether the interview already has an
// unanswered reschedule request — a second one would leave whichever gets
// settled first silently invalidating the other.
func (h *InterviewController) openReschedulePending(interviewID uint) (bool, error) {
	var open models.RescheduleInterview
	err := h.db.Where("interview_schedule_id = ? AND status = ?", interviewID, "pending").First(&open).Error
	if err == nil {
		return true, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return false, err
}

// createReschedule inserts the request, runs extra (if given) in the same
// transaction — the employer flow uses it to insert the offered
// RescheduleProposedSlot rows once reschedule.RescheduleID is known — and
// flips the interview to "rescheduling". If the pre-insert
// openReschedulePending check above raced another request and lost, the
// partial unique index on (interview_schedule_id) WHERE status='pending' (#6)
// rejects the insert; that is mapped back to the same message the check gives
// in the common case.
// แกนกลางของทั้ง 2 flow เลื่อนนัด: INSERT คำขอ (+ slots ถ้าเป็นฝั่งผู้ประกอบการ) + เปลี่ยนนัดเป็น "rescheduling" ใน Transaction เดียว
// ถ้า 2 คำขอยิงมาพร้อมกันจริงๆ unique index บน (interview_schedule_id) WHERE status='pending' กันให้ที่ระดับ DB
func (h *InterviewController) createReschedule(c *gin.Context, interview *models.InterviewSchedule, reschedule *models.RescheduleInterview, extra func(tx *gorm.DB) error) bool {
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(reschedule).Error; err != nil {
			return err
		}
		if extra != nil {
			if err := extra(tx); err != nil {
				return err
			}
		}
		return tx.Model(interview).Update("status", "rescheduling").Error
	})
	if err != nil {
		if utils.IsUniqueViolation(err) {
			utils.JSONError(c, http.StatusBadRequest, "request failed", "there is already a reschedule request waiting for an answer")
			return false
		}
		utils.JSONInternalError(c, "request failed", err)
		return false
	}
	return true
}

// ┌─ [U3 ทางที่ 1] POST /api/v1/student/interviews/:id/reschedule ─ นศ. ขอเลื่อนนัด ──┐
// │ นศ. เสนอ 1 เวลา → ผู้ประกอบการต้อง อนุมัติ/ปฏิเสธ ที่ RespondToReschedule           │
// │ Activity Diagram: ทางแยก "Available on schedule?" → Not available → มาที่นี่        │
// │ กฎ 3 ข้อ: นัดจบแล้วเลื่อนไม่ได้ / เปิดคำขอค้างได้ครั้งละ 1 / เวลาต้อง UTC RFC3339   │
// │ เขียนตาราง reschedule_interviews (requested_by="student", status="pending")       │
// └────────────────────────────────────────────────────────────────────────────────────┘
// RequestReschedule is the student asking to move an interview to a single
// time; the employer then approves or rejects it via
// ApproveReschedule/RejectReschedule. Split from the employer's
// OfferRescheduleSlots below because the two flows don't share a shape (one
// time vs. up to five, and no approval step after the student's pick).
func (h *InterviewController) RequestReschedule(c *gin.Context) {
	interview, ok := h.partyToInterview(c)
	if !ok {
		return
	}
	// Nothing left to move once the interview has been held and its result sent.
	if interview.Status == "completed" || interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "this interview is already finished")
		return
	}

	var payload dto.RequestRescheduleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	if open, err := h.openReschedulePending(interview.InterviewID); err != nil {
		utils.JSONInternalError(c, "request failed", err)
		return
	} else if open {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "there is already a reschedule request waiting for an answer")
		return
	}

	// ขั้น 4: เวลาที่ นศ. เสนอ ต้องเป็น UTC RFC3339
	t, valid := utcInstant(payload.StudentAvailableDateTime)
	if !valid {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "student_available_date_time must be RFC3339 in UTC, e.g. 2026-09-20T13:30:00Z")
		return
	}

	// ขั้น 5: สร้างคำขอ requested_by=student status=pending — ยังไม่แตะเวลานัดจริง จนผู้ประกอบการอนุมัติ
	reschedule := &models.RescheduleInterview{
		InterviewScheduleID:      interview.InterviewID,
		RescheduleReason:         payload.Reason,
		RequestedBy:              "student",
		Status:                   "pending",
		StudentAvailableDateTime: &t,
	}
	if !h.createReschedule(c, interview, reschedule, nil) {
		return
	}

	// ขั้น 6: แจ้งผู้ประกอบการ (U4) พร้อม FK reschedule_id → กล่องแจ้งเตือนจึงโชว์ปุ่ม อนุมัติ/ปฏิเสธ ได้ตรงนั้น
	var employer models.Employer
	h.db.First(&employer, interview.EmployerID)
	notifyAboutReschedule(h.db, employer.UserID, "นักศึกษาขอเลื่อนนัดสัมภาษณ์", "interview_reschedule_request",
		fmt.Sprintf("%s ขอเลื่อนนัดเป็นวันที่ %s — กรุณาอนุมัติหรือปฏิเสธ%s",
			h.studentName(interview.StudentID), t.Format("2006-01-02 15:04"), reasonSuffix(payload.Reason)),
		interview.InterviewID, reschedule.RescheduleID)

	utils.JSONSuccess(c, http.StatusCreated, mapRescheduleToResponse(reschedule))
}

// ┌─ [U3 ทางที่ 2] POST /api/v1/employer/interviews/:id/reschedule-offer ─────────────┐
// │ ผู้ประกอบการเสนอ ≤5 เวลา → นศ. เลือก 1 ที่ SelectRescheduleSlot (ไม่ต้องอนุมัติซ้ำ)  │
// │ ทางนี้เพิ่มจากการทดสอบจริง — ผู้ประกอบการก็ติดธุระได้ ไม่ใช่แค่ นศ.                  │
// │ เวลาแต่ละตัว = 1 แถวใน reschedule_proposed_slots                                    │
// │   (Class Diagram: RescheduleInterview 1 ── 0..* RescheduleProposedSlot)            │
// │ Transaction: สร้าง reschedule + slots ทุกแถว สำเร็จพร้อมกันหรือไม่สำเร็จเลย          │
// └────────────────────────────────────────────────────────────────────────────────────┘
// OfferRescheduleSlots is the employer offering the student several times to
// choose from instead of asking the student for one. The student then picks
// one via SelectRescheduleSlot — there is no further approval step, since the
// employer already committed to every slot they listed.
func (h *InterviewController) OfferRescheduleSlots(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}
	// Nothing left to move once the interview has been held and its result sent.
	if interview.Status == "completed" || interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "this interview is already finished")
		return
	}

	var payload dto.OfferRescheduleSlotsRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	if open, err := h.openReschedulePending(interview.InterviewID); err != nil {
		utils.JSONInternalError(c, "request failed", err)
		return
	} else if open {
		utils.JSONError(c, http.StatusBadRequest, "request failed", "there is already a reschedule request waiting for an answer")
		return
	}

	// Store the offered times normalised so the student's later pick can be
	// matched exactly against the list.
	// ขั้น 4: แปลงทุกเวลาที่เสนอเป็น UTC — ผิดตัวเดียว 400 ทั้งคำขอ
	slots := make([]time.Time, 0, len(payload.ProposedSlots))
	for _, raw := range payload.ProposedSlots {
		t, valid := utcInstant(raw)
		if !valid {
			utils.JSONError(c, http.StatusBadRequest, "request failed", "each proposed slot must be RFC3339 in UTC, e.g. 2026-09-20T13:30:00Z")
			return
		}
		slots = append(slots, t)
	}

	// ขั้น 5: คำขอ requested_by=employer — เวลาที่เสนอไปอยู่ตารางลูก reschedule_proposed_slots ไม่ได้อยู่ในแถวนี้
	reschedule := &models.RescheduleInterview{
		InterviewScheduleID: interview.InterviewID,
		RescheduleReason:    payload.Reason,
		RequestedBy:         "employer",
		Status:              "pending",
	}
	// Inserted alongside reschedule in the same transaction (createReschedule's
	// extra), once reschedule.RescheduleID exists to reference — then assigned
	// back onto reschedule.ProposedSlots here for the response mapped below,
	// without a second round trip to read them back.
	slotRows := make([]models.RescheduleProposedSlot, 0, len(slots))
	if !h.createReschedule(c, interview, reschedule, func(tx *gorm.DB) error {
		for _, s := range slots {
			slotRows = append(slotRows, models.RescheduleProposedSlot{RescheduleInterviewID: reschedule.RescheduleID, SlotAt: s})
		}
		if len(slotRows) == 0 {
			return nil
		}
		return tx.Create(&slotRows).Error
	}) {
		return
	}
	reschedule.ProposedSlots = slotRows

	// ขั้น 6: แจ้งนักศึกษา (U4) → กล่องแจ้งเตือนโชว์ radio เลือกเวลา
	notifyAboutReschedule(h.db, interview.StudentID, "ผู้ประกอบการขอเลื่อนนัดสัมภาษณ์", "interview_reschedule_offer",
		fmt.Sprintf("%s เสนอวันสัมภาษณ์ใหม่ %d วันให้เลือก — กรุณาเลือกวันที่สะดวก%s",
			employer.CompanyName, len(slots), reasonSuffix(payload.Reason)),
		interview.InterviewID, reschedule.RescheduleID)

	utils.JSONSuccess(c, http.StatusCreated, mapRescheduleToResponse(reschedule))
}

// reasonSuffix appends the requester's note to a notification when they wrote one.
func reasonSuffix(reason string) string {
	if strings.TrimSpace(reason) == "" {
		return ""
	}
	return " (เหตุผล: " + reason + ")"
}

// parseAppointmentDateTime parses and validates a caller-supplied date/time
// pair into the canonical shape every appointment write uses: a UTC-midnight
// time.Time for the date, and a zero-padded 24-hour "HH:MM" string for the
// time. CreateInterview and UpdateInterview both go through this, so a typed
// appointment_time (previously stored as whatever raw string the client sent)
// can no longer drift from the HH:MM shape reschedules write.
func parseAppointmentDateTime(dateStr, timeStr string) (date time.Time, canonicalTime string, err error) {
	date, err = time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, "", errors.New("appointment_date must be YYYY-MM-DD")
	}
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		return time.Time{}, "", errors.New("appointment_time must be HH:MM (24-hour)")
	}
	return date, t.Format("15:04"), nil
}

// setAppointment is the single writer for an interview's schedule columns —
// appointment_date, appointment_time, and (via extra) whatever else is
// changing alongside them. Every handler that moves an appointment goes
// through it, so the two date/time columns can't end up in different
// encodings depending on which handler wrote them: previously UpdateInterview
// saved the caller's raw time string next to a bare date.Parse, while
// applySlotToInterview computed a UTC-normalised HH:MM from an instant — two
// shapes for the same pair of columns.
func setAppointment(tx *gorm.DB, interviewID uint, date time.Time, timeStr string, extra map[string]any) error {
	updates := map[string]any{
		"appointment_date": date,
		"appointment_time": timeStr,
	}
	for k, v := range extra {
		updates[k] = v
	}
	return tx.Model(&models.InterviewSchedule{}).Where("interview_id = ?", interviewID).Updates(updates).Error
}

// applySlotToInterview moves the appointment to t and puts the interview back
// to a confirmed state, so an agreed reschedule leaves nothing stuck in
// "rescheduling".
func (h *InterviewController) applySlotToInterview(tx *gorm.DB, interviewID uint, t time.Time) error {
	// Slots arrive as UTC and are stored that way, but the driver hands them back
	// in the server's local zone. Normalising here keeps the wall clock the user
	// picked — without it a 14:00 request lands on the appointment as 21:00.
	utc := t.UTC()
	day := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	return setAppointment(tx, interviewID, day, utc.Format("15:04"), map[string]any{"status": "confirmed"})
}

// ┌─ [U3] POST /api/v1/employer/reschedules/:id/approve | /reject ────────────────────┐
// │ ผู้ประกอบการตอบคำขอเลื่อนของ นศ.  (ApproveReschedule / RejectReschedule เรียกมาที่นี่) │
// │ ตรวจ 4 ชั้นก่อนทำ: เป็นเจ้าของนัด → คำขอเป็นฝั่ง student → ยัง pending → payload ถูก │
// │ Transaction: อัปเดต reschedule (status, responded_at) + ย้ายเวลานัดพร้อมกัน          │
// │   อนุมัติ → applySlotToInterview ย้ายวัน/เวลา + status=confirmed                     │
// │   ปฏิเสธ → เวลาเดิมคงอยู่ status กลับเป็น confirmed (ไม่ค้าง rescheduling)           │
// │ จบด้วยแจ้งเตือน นศ. (U4) ทั้ง 2 กรณี                                                 │
// └────────────────────────────────────────────────────────────────────────────────────┘
// RespondToReschedule is the employer approving or rejecting the time a student
// asked to move to. Approving moves the appointment; rejecting leaves the
// original time standing. Either way the interview stops being "rescheduling".
func (h *InterviewController) RespondToReschedule(c *gin.Context, approve bool) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid reschedule id", "id must be a number")
		return
	}

	var reschedule models.RescheduleInterview
	if err := h.db.First(&reschedule, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	// ตรวจ 2: นัดของคำขอนี้ต้องเป็นของผู้ประกอบการคนนี้ (ไม่ใช่ → 404 ทำเหมือนไม่มี ไม่บอกว่ามีอยู่)
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, reschedule.InterviewScheduleID).Error; err != nil || interview.EmployerID != employer.UserID {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	// ตรวจ 3: ต้องเป็นคำขอฝั่งนักศึกษา — คำขอที่ตัวเองเสนอ จะมาอนุมัติเองไม่ได้
	if reschedule.RequestedBy != "student" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request is for the student to answer, not you")
		return
	}
	// ตรวจ 4: ยังไม่เคยตอบ (ตอบซ้ำไม่ได้)
	if reschedule.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this reschedule request has already been answered")
		return
	}

	// The reason is optional, so an empty body is fine — but a body that was
	// sent and is malformed should not be silently ignored.
	var payload dto.RejectRescheduleRequest
	if err := c.ShouldBindJSON(&payload); err != nil && !errors.Is(err, io.EOF) {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}

	// ลงมือใน Transaction เดียว: (1) อัปเดตคำขอ status + responded_at (+ เวลาใหม่ถ้าอนุมัติ)  (2) ย้ายนัด หรือคืนสถานะนัด
	now := time.Now().UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{"responded_at": &now}
		if approve {
			updates["status"] = "accepted"
			updates["new_appointment_date_time"] = reschedule.StudentAvailableDateTime
		} else {
			updates["status"] = "rejected"
		}
		if err := tx.Model(&models.RescheduleInterview{}).Where("reschedule_id = ?", reschedule.RescheduleID).
			Updates(updates).Error; err != nil {
			return err
		}
		if approve && reschedule.StudentAvailableDateTime != nil {
			return h.applySlotToInterview(tx, interview.InterviewID, *reschedule.StudentAvailableDateTime)
		}
		// Turned down: the original appointment stands, so hand the interview back
		// to its pre-request state rather than leaving it in "rescheduling".
		return tx.Model(&models.InterviewSchedule{}).Where("interview_id = ?", interview.InterviewID).
			Update("status", "confirmed").Error
	}); err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	// แจ้งนักศึกษาผลการตอบ (U4) — ข้อความต่างกันตามอนุมัติ/ปฏิเสธ
	var student models.Student
	h.db.First(&student, interview.StudentID)
	if approve {
		notifyAboutReschedule(h.db, student.UserID, "อนุมัติการเลื่อนนัดสัมภาษณ์", "interview_reschedule_result",
			fmt.Sprintf("%s อนุมัติการเลื่อนนัดแล้ว นัดใหม่คือวันที่ %s — รอผลการสัมภาษณ์ต่อไป",
				employer.CompanyName, reschedule.StudentAvailableDateTime.UTC().Format("2006-01-02 15:04")),
			interview.InterviewID, reschedule.RescheduleID)
	} else {
		notifyAboutReschedule(h.db, student.UserID, "ไม่อนุมัติการเลื่อนนัดสัมภาษณ์", "interview_reschedule_result",
			fmt.Sprintf("%s ไม่อนุมัติการเลื่อนนัด กำหนดการเดิมยังมีผลอยู่%s", employer.CompanyName, reasonSuffix(payload.Reason)),
			interview.InterviewID, reschedule.RescheduleID)
	}

	h.db.Preload("ProposedSlots").First(&reschedule, reschedule.RescheduleID)
	utils.JSONSuccess(c, http.StatusOK, mapRescheduleToResponse(&reschedule))
}

// ApproveReschedule accepts the student's proposed time.
func (h *InterviewController) ApproveReschedule(c *gin.Context) { h.RespondToReschedule(c, true) }

// RejectReschedule declines the student's proposed time.
func (h *InterviewController) RejectReschedule(c *gin.Context) { h.RespondToReschedule(c, false) }

// ┌─ [U3] POST /api/v1/student/reschedules/:id/select ─ นศ. เลือกเวลา ─────────────────┐
// │ ตรวจ: เป็น นศ. ของนัดนี้ → คำขอเป็นฝั่ง employer → ยัง pending                        │
// │ กฎสำคัญ: เลือกได้เฉพาะเวลาที่มีในตาราง reschedule_proposed_slots จริง                │
// │   (Count == 0 → 400) กัน นศ. ส่งเวลาที่ผู้ประกอบการไม่ได้เสนอ                          │
// │ Transaction: reschedule → accepted + new_appointment_date_time, นัด → เวลาใหม่        │
// └────────────────────────────────────────────────────────────────────────────────────┘
// SelectRescheduleSlot is the student choosing one of the times the employer
// offered. There is no further approval step — the employer already committed to
// every slot they listed, so picking one settles the appointment immediately.
func (h *InterviewController) SelectRescheduleSlot(c *gin.Context) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid reschedule id", "id must be a number")
		return
	}

	var reschedule models.RescheduleInterview
	if err := h.db.First(&reschedule, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	// ตรวจ 2: นัดของคำขอนี้ต้องเป็นของนักศึกษาที่ล็อกอิน (ไม่ใช่ → 404)
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, reschedule.InterviewScheduleID).Error; err != nil || interview.StudentID != userID {
		utils.JSONError(c, http.StatusNotFound, "reschedule request not found", "no reschedule request exists with the given id")
		return
	}
	// ตรวจ 3: ต้องเป็นคำขอฝั่งผู้ประกอบการ (ถึงจะมีเวลาให้เลือก)
	if reschedule.RequestedBy != "employer" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this request is for the employer to answer, not you")
		return
	}
	if reschedule.Status != "pending" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this reschedule request has already been answered")
		return
	}

	var payload dto.SelectRescheduleSlotRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}
	// ขั้น 4: เวลาที่เลือกต้องเป็น UTC RFC3339
	chosen, valid := utcInstant(payload.SelectedDateTime)
	if !valid {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "selected_date_time must be RFC3339 in UTC")
		return
	}
	// Only a time the employer actually offered may be chosen. timestamptz
	// equality in Postgres compares by absolute instant, so this doesn't need
	// the exact-string-match care the old comma-joined column did.
	// ขั้น 5 (กฎสำคัญ): เวลาที่เลือกต้องมีอยู่ในตาราง reschedule_proposed_slots ของคำขอนี้จริง — เทียบ timestamptz ตรงๆ
	var offeredCount int64
	if err := h.db.Model(&models.RescheduleProposedSlot{}).
		Where("reschedule_interview_id = ? AND slot_at = ?", reschedule.RescheduleID, chosen).
		Count(&offeredCount).Error; err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}
	if offeredCount == 0 {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "pick one of the dates the employer offered")
		return
	}

	// ขั้น 6: Transaction — คำขอ → accepted + new_appointment_date_time, นัด → วัน/เวลาใหม่ status=confirmed
	now := time.Now().UTC()
	utc := chosen.UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.RescheduleInterview{}).Where("reschedule_id = ?", reschedule.RescheduleID).
			Updates(map[string]any{
				"status":                    "accepted",
				"new_appointment_date_time": &utc,
				"responded_at":              &now,
			}).Error; err != nil {
			return err
		}
		return h.applySlotToInterview(tx, interview.InterviewID, utc)
	}); err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	// ขั้น 7: แจ้งผู้ประกอบการว่านักศึกษาเลือกเวลาไหน (U4)
	var employer models.Employer
	h.db.First(&employer, interview.EmployerID)
	notifyAboutReschedule(h.db, employer.UserID, "นักศึกษาเลือกวันสัมภาษณ์แล้ว", "interview_reschedule_result",
		fmt.Sprintf("%s เลือกวันสัมภาษณ์เป็นวันที่ %s", h.studentName(interview.StudentID), utc.Format("2006-01-02 15:04")),
		interview.InterviewID, reschedule.RescheduleID)

	h.db.Preload("ProposedSlots").First(&reschedule, reschedule.RescheduleID)
	utils.JSONSuccess(c, http.StatusOK, mapRescheduleToResponse(&reschedule))
}

// [U8] GET /api/v1/interviews/:id/reschedules — ประวัติเลื่อนนัดของนัดหนึ่ง
// partyToInterview = ทั้ง นศ. และผู้ประกอบการของนัดนี้ดูได้ คนนอกได้ 404
// ListReschedules returns the reschedule history for one interview.
func (h *InterviewController) ListReschedules(c *gin.Context) {
	interview, ok := h.partyToInterview(c)
	if !ok {
		return
	}
	var reschedules []models.RescheduleInterview
	if err := h.db.Preload("ProposedSlots").Where("interview_schedule_id = ?", interview.InterviewID).Order("created_at DESC").Find(&reschedules).Error; err != nil {
		utils.JSONInternalError(c, "failed to load reschedule history", err)
		return
	}
	responses := make([]dto.RescheduleResponse, 0, len(reschedules))
	for _, r := range reschedules {
		responses = append(responses, mapRescheduleToResponse(&r))
	}
	utils.JSONSuccess(c, http.StatusOK, responses)
}

// ┌─ [U5] POST /api/v1/employer/interviews/:id/result ─ ประกาศผลสัมภาษณ์ ──────────────┐
// │ Activity Diagram: "Record screening result (U5)" → "Send result to applicant (U4)" │
// │ เก็บ result / result_comment / result_announced_at ลงตาราง + status=completed      │
// │ กฎ: ประกาศได้ครั้งเดียว (Result != "" → 400)                                        │
// │ *** ค่า result="passed" คือ "ประตู" เข้าสู่ระบบย่อยที่ 2 ***                          │
// │     EmploymentController.CreateAgreement เช็ค Result == "passed" ก่อนสร้างข้อตกลง     │
// │     (Use Case: U6 «extend» U5)                                                      │
// └────────────────────────────────────────────────────────────────────────────────────┘
// SendResult notifies the student of their interview outcome and persists it on
// the InterviewSchedule (Result / ResultComment / ResultAnnouncedAt, status
// "completed"). The stored "passed" is what gates drafting an employment
// agreement, so it has to outlive the notification.
func (h *InterviewController) SendResult(c *gin.Context) {
	employer, ok := h.currentEmployer(c)
	if !ok {
		return
	}
	interview, ok := h.ownedByEmployer(c, employer.UserID)
	if !ok {
		return
	}

	var payload dto.InterviewResultRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid request payload", err.Error())
		return
	}
	if err := h.validate.Struct(payload); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "validation error", err.Error())
		return
	}

	// The result drives what the student is told and whether an employment
	// agreement may be drafted, so it is announced once and not overwritten.
	// กฎ: ประกาศแล้วประกาศซ้ำไม่ได้ — เพราะค่า passed ถูกใช้เป็นเงื่อนไขของระบบจ้างงานต่อ (เปลี่ยนทีหลังจะพัง flow)
	if interview.Result != "" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "the result for this interview has already been announced")
		return
	}

	// Persist the outcome so the student can re-open the result page later and
	// the employer can see which candidates have already been told.
	// บันทึกผลลง DB จริง (ไม่ใช่แค่ส่งแจ้งเตือน) → นศ. เปิดดูผลย้อนหลังได้ / ผู้ประกอบการรู้ว่าประกาศใครไปแล้ว
	now := time.Now()
	if err := h.db.Model(interview).Updates(map[string]any{
		"result":              payload.Result,
		"result_comment":      payload.Comment,
		"result_announced_at": &now,
		"status":              "completed",
	}).Error; err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	var student models.Student
	h.db.First(&student, interview.StudentID)

	// ประกอบข้อความแจ้งเตือน (U4): ผ่าน/ไม่ผ่าน + ความเห็นถ้ามี
	message := fmt.Sprintf("ผลการสัมภาษณ์ตำแหน่งที่ %s: ", employer.CompanyName)
	if payload.Result == "passed" {
		message += "ผ่านการสัมภาษณ์ กรุณารอข้อตกลงการจ้างงาน"
	} else {
		message += "ไม่ผ่านการสัมภาษณ์"
	}
	if payload.Comment != "" {
		message += " (" + payload.Comment + ")"
	}
	notifyAboutInterview(h.db, student.UserID, "ผลการพิจารณาสัมภาษณ์", "interview_result", message, interview.InterviewID)

	utils.JSONSuccess(c, http.StatusOK, gin.H{"sent": true, "result": payload.Result})
}

// ┌─ [U2] POST /api/v1/student/interviews/:id/confirm ─ นศ. ยืนยันเข้าสัมภาษณ์ ────────┐
// │ Activity Diagram: "Available on schedule?" → Available → ที่นี่ / Not → U3          │
// │ status → confirmed + confirmed_at  แล้วแจ้งผู้ประกอบการ (U4)                          │
// │ กฎ: นัดที่ completed / cancelled ยืนยันไม่ได้ (กัน status ถอยหลัง)                    │
// └────────────────────────────────────────────────────────────────────────────────────┘
// ConfirmAttendance lets the student confirm they'll attend a scheduled interview.
// The confirmation is persisted on the schedule so the UI can show the
// "รอการยืนยัน" / "ยืนยันแล้ว" badge, and a notification goes to the employer.
func (h *InterviewController) ConfirmAttendance(c *gin.Context) {
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
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return
	}
	// ตรวจความเป็นเจ้าของในตัว query เลย: นัด :id ต้องมี student_id = ฉัน (ไม่ใช่ → 404)
	var interview models.InterviewSchedule
	if err := h.db.Where("interview_id = ? AND student_id = ?", id, student.UserID).First(&interview).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return
	}
	// Confirming attendance is only meaningful while the appointment is still
	// ahead. Allowing it afterwards rewinds status from "completed" back to
	// "confirmed", which leaves an announced result sitting on a schedule that
	// claims the interview has not happened yet.
	if interview.Status == "completed" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this interview is already finished")
		return
	}
	if interview.Status == "cancelled" {
		utils.JSONError(c, http.StatusBadRequest, "action failed", "this interview has been cancelled")
		return
	}

	// บันทึก status=confirmed + เวลาที่ยืนยัน
	confirmedAt := time.Now()
	if err := h.db.Model(&interview).Updates(map[string]any{
		"status":       "confirmed",
		"confirmed_at": &confirmedAt,
	}).Error; err != nil {
		utils.JSONInternalError(c, "action failed", err)
		return
	}

	// แจ้งผู้ประกอบการว่านักศึกษายืนยันแล้ว (U4)
	appointmentDate := ""
	if interview.AppointmentDate != nil {
		appointmentDate = interview.AppointmentDate.Format("2006-01-02")
	}
	var employer models.Employer
	if err := h.db.First(&employer, interview.EmployerID).Error; err == nil {
		notifyAboutInterview(h.db, employer.UserID, "นักศึกษายืนยันเข้ารับสัมภาษณ์", "interview_confirmed",
			fmt.Sprintf("%s ยืนยันนัดสัมภาษณ์วันที่ %s เวลา %s น. แล้ว", h.studentName(student.UserID), appointmentDate, interview.AppointmentTime),
			interview.InterviewID)
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"confirmed": true})
}

// ── helper ตรวจสิทธิ์ (ใช้ซ้ำทุก handler) ──────────────────────────────────────────────
//
//	currentEmployer  : user จาก JWT ต้องมีโปรไฟล์ Employer
//	ownedByEmployer  : นัด :id ต้องเป็นของ employer คนนี้ — ไม่ใช่ → 404 (กัน IDOR)
//	partyToInterview : ผู้เรียกต้องเป็น "คู่นัด" (student หรือ employer ของนัดนั้น)
//
// หลัก: ทุก endpoint ตรวจความเป็นเจ้าของที่ backend เสมอ UI มีไว้เพื่อ UX เท่านั้น
func (h *InterviewController) currentEmployer(c *gin.Context) (*models.Employer, bool) {
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

func (h *InterviewController) ownedByEmployer(c *gin.Context, employerID uint) (*models.InterviewSchedule, bool) {
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return nil, false
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	if interview.EmployerID != employerID {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	return &interview, true
}

// partyToInterview loads the interview named by :id but only for the two people
// actually on it — the student it was booked for, or the employer who booked it.
// Reschedule requests and their history are shared by both sides, so neither an
// employer-only nor a student-only guard fits; without this any signed-in user
// could reschedule or read someone else's appointment by guessing its id.
func (h *InterviewController) partyToInterview(c *gin.Context) (*models.InterviewSchedule, bool) {
	userID, ok := utils.GetUserIDFromContext(c)
	if !ok {
		utils.JSONError(c, http.StatusUnauthorized, "authorization required", "user id missing from token")
		return nil, false
	}
	id, err := utils.ParseUintParam(c, "id")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid interview id", "id must be a number")
		return nil, false
	}
	var interview models.InterviewSchedule
	if err := h.db.First(&interview, id).Error; err != nil {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	// Student and employer ids both reference users.user_id, so the caller's own
	// id is enough to tell whether they are on this appointment.
	if interview.StudentID != userID && interview.EmployerID != userID {
		utils.JSONError(c, http.StatusNotFound, "interview not found", "no interview exists with the given id")
		return nil, false
	}
	return &interview, true
}

func (h *InterviewController) studentName(studentID uint) string {
	var student models.Student
	if err := h.db.First(&student, studentID).Error; err != nil {
		return ""
	}
	return fmt.Sprintf("%s %s", student.FirstName, student.LastName)
}

func (h *InterviewController) companyName(employerID uint) string {
	var employer models.Employer
	if err := h.db.Select("company_name").First(&employer, employerID).Error; err != nil {
		return ""
	}
	return employer.CompanyName
}

// ── DTO mapping ── แปลง model → response  (ไม่ส่ง struct model ตรงออก API)
// วันเป็น "YYYY-MM-DD", เวลา "HH:MM", timestamp เป็น RFC3339 — หน้า React จึง format ง่าย
func (h *InterviewController) mapToResponse(iv *models.InterviewSchedule, companyName, studentName string) dto.InterviewResponse {
	appointmentDate := ""
	if iv.AppointmentDate != nil {
		appointmentDate = iv.AppointmentDate.Format("2006-01-02")
	}
	reschedules := make([]dto.RescheduleResponse, 0, len(iv.Reschedules))
	for i := range iv.Reschedules {
		reschedules = append(reschedules, mapRescheduleToResponse(&iv.Reschedules[i]))
	}
	return dto.InterviewResponse{
		ID:                 iv.InterviewID,
		ApplicationID:      iv.ApplicationID,
		StudentID:          iv.StudentID,
		StudentName:        studentName,
		EmployerID:         iv.EmployerID,
		CompanyName:        companyName,
		InterviewFormat:    iv.InterviewFormat,
		AppointmentDate:    appointmentDate,
		AppointmentTime:    iv.AppointmentTime,
		Location:           iv.Location,
		PreparationDetails: iv.PreparationDetails,
		Status:             iv.Status,
		Result:             iv.Result,
		ResultComment:      iv.ResultComment,
		CreatedAt:          iv.CreatedAt.Format(time.RFC3339),
		Reschedules:        reschedules,
	}
}

func mapRescheduleToResponse(r *models.RescheduleInterview) dto.RescheduleResponse {
	studentAvailable := ""
	if r.StudentAvailableDateTime != nil {
		studentAvailable = r.StudentAvailableDateTime.Format(time.RFC3339)
	}
	newAppointment := ""
	if r.NewAppointmentDateTime != nil {
		newAppointment = r.NewAppointmentDateTime.Format(time.RFC3339)
	}
	respondedAt := ""
	if r.RespondedAt != nil {
		respondedAt = r.RespondedAt.Format(time.RFC3339)
	}
	// Sorted chronologically regardless of read order — the child table carries
	// no ordering guarantee of its own.
	sortedSlots := append([]models.RescheduleProposedSlot(nil), r.ProposedSlots...)
	sort.Slice(sortedSlots, func(i, j int) bool { return sortedSlots[i].SlotAt.Before(sortedSlots[j].SlotAt) })
	slots := make([]string, 0, len(sortedSlots))
	for _, s := range sortedSlots {
		slots = append(slots, s.SlotAt.UTC().Format(time.RFC3339))
	}
	return dto.RescheduleResponse{
		ID:                       r.RescheduleID,
		RequestedBy:              r.RequestedBy,
		Status:                   r.Status,
		StudentAvailableDateTime: studentAvailable,
		ProposedSlots:            slots,
		NewAppointmentDateTime:   newAppointment,
		RescheduleReason:         r.RescheduleReason,
		RespondedAt:              respondedAt,
		CreatedAt:                r.CreatedAt.Format(time.RFC3339),
	}
}

// ═══ [U4] Send Appointment and Status Notifications ═══════════════════════════════════
// lifeline ":NotificationService" ใน Sequence Diagram = ฟังก์ชันกลุ่มนี้
// (Go ไม่บังคับ OOP จึงเป็นฟังก์ชัน ไม่ใช่ class แยก)
// เขียนตาราง notifications พร้อม FK → interview_schedule_id / reschedule_interview_id
// FK นี้ทำให้หน้าแจ้งเตือน (RescheduleAction ใน pages/notifications) รู้ว่าแจ้งเตือนนี้
// เกี่ยวกับคำขอไหน → แสดงปุ่ม อนุมัติ/ปฏิเสธ หรือ radio เลือกเวลา ได้ในแจ้งเตือนเลย
// ═════════════════════════════════════════════════════════════════════════════════════
// notifyAboutInterview is notifyUser plus a link back to the interview that
// triggered it, so the notification list can deep-link into the appointment.
// notifyAboutReschedule links the notification to both the interview and the
// reschedule request behind it, so the student's notification can open straight
// into the slot picker for that specific request.
func notifyAboutReschedule(db *gorm.DB, userID uint, title, notificationType, message string, interviewID, rescheduleID uint) {
	n := &models.Notification{
		UserID:                userID,
		InterviewScheduleID:   &interviewID,
		RescheduleInterviewID: &rescheduleID,
		Title:                 title,
		NotificationType:      notificationType,
		Message:               message,
	}
	if err := db.Create(n).Error; err != nil {
		log.Printf("failed to create notification for user %d: %v", userID, err)
	}
}

func notifyAboutInterview(db *gorm.DB, userID uint, title, notificationType, message string, interviewID uint) {
	n := &models.Notification{
		UserID:              userID,
		InterviewScheduleID: &interviewID,
		Title:               title,
		NotificationType:    notificationType,
		Message:             message,
	}
	if err := db.Create(n).Error; err != nil {
		log.Printf("failed to create notification for user %d: %v", userID, err)
	}
}
