package models

import "time"

// ═══════════════════════════════════════════════════════════════════════════════
// [B6733827] Entity / Model ของทั้ง 2 ระบบย่อย  =  Class Diagram หัวข้อ 7 → ตารางจริง
//
//	Class (Diagram)          struct (ไฟล์นี้)          ตาราง PostgreSQL (GORM AutoMigrate)
//	─────────────────────    ──────────────────────    ────────────────────────────────
//	InterviewSchedule        InterviewSchedule         interview_schedules
//	RescheduleInterview      RescheduleInterview       reschedule_interviews
//	RescheduleProposedSlot   RescheduleProposedSlot    reschedule_proposed_slots
//	EmploymentAgreement      EmploymentAgreement       employment_agreements
//	Document                 Document                  documents
//
// วิธีอ่าน struct tag ของ GORM
//
//	gorm:"primaryKey"                → PK
//	gorm:"not null;index"            → FK ที่ทำ index ไว้ (query เร็ว)
//	*uint / *time.Time (pointer)     → คอลัมน์ NULL ได้  (FK ที่ไม่บังคับ / เวลาที่ยังไม่เกิด)
//	gorm:"size:50;default:'pending'" → VARCHAR(50) ค่าเริ่มต้น 'pending'
//	gorm:"type:text"                 → TEXT (ข้อความยาว)
//	gorm:"type:decimal(10,2)"        → เงิน (WageRate) ไม่ใช้ float ใน DB กันปัดเศษ
//
// ความสัมพันธ์ (field ที่เป็น slice/pointer ไปยัง struct อื่น)
//
//	[]X  + foreignKey  = has-many  (1 ── 0..*)      เช่น InterviewSchedule.Reschedules
//	*X   + foreignKey  = has-one   (1 ── 0..1)      เช่น InterviewSchedule.Agreement
//	*X   ที่อีกฝั่งถือ FK = belongs-to               เช่น EmploymentAgreement.InterviewSchedule
//
// ═══════════════════════════════════════════════════════════════════════════════
// InterviewSchedule represents an interview appointment between a Student and an Employer.
// Location isn't a literal diagram attribute (same pragmatic addition as
// EmploymentAgreement.Status above) — it stores the onsite address or the
// online meeting link shown in the "สถานที่ / ลิงก์สัมภาษณ์" design field.
type InterviewSchedule struct {
	InterviewID uint      `gorm:"primaryKey" json:"interview_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	// ApplicationID ties the appointment to the specific application it is for.
	// A student may hold several accepted applications with the same employer
	// (one per position), and each needs its own interview — keyed only by
	// student, one appointment would mark every one of their applications as
	// already scheduled. Nullable so rows created before this existed still load.
	// FK → applications  : 1 ใบสมัคร มีนัดได้ 0..1  (Class Diagram: Application 1 ── 0..1)
	// เป็น pointer (NULL ได้) เพราะแถวเก่าที่สร้างก่อนมี field นี้ต้องยังโหลดได้
	ApplicationID *uint `gorm:"index" json:"application_id"`
	// FK → students / employers  (Class Diagram: Student 1 ── 0..* , Employer 1 ── 0..*)
	StudentID  uint `gorm:"not null;index" json:"student_id"`
	EmployerID uint `gorm:"not null;index" json:"employer_id"`
	// รายละเอียดนัด (U1): รูปแบบ online|onsite / เวลา "HH:MM" / วัน (timestamp เที่ยงคืน UTC) / สถานที่หรือลิงก์ / สิ่งที่ต้องเตรียม
	InterviewFormat    string     `gorm:"size:100" json:"interview_format"` // online | onsite
	AppointmentTime    string     `gorm:"size:20" json:"appointment_time"`  // e.g. "10:30"
	AppointmentDate    *time.Time `json:"appointment_date"`
	Location           string     `gorm:"size:500" json:"location"`
	PreparationDetails string     `gorm:"type:text" json:"preparation_details"`

	// สถานะ + ผล = สิ่งที่ UI ใช้วาด Chip และที่ controller ใช้เป็น guard (แก้/เลื่อน/ยืนยันไม่ได้เมื่อจบ)
	// Status tracks where the appointment stands so the UI can render its badge
	// ("รอการยืนยัน" / "สัมภาษณ์แล้ว" / "ยกเลิกนัด"). Previously ConfirmAttendance
	// only fired a notification, so nothing could be queried back.
	// pending | confirmed | rescheduling | completed | cancelled
	Status      string     `gorm:"size:50;not null;default:'pending'" json:"status"`
	ConfirmedAt *time.Time `json:"confirmed_at"`

	// ผลสัมภาษณ์ (U5): "" = ยังไม่ประกาศ | passed | failed  + ความเห็น + เวลาที่ประกาศ  — passed คือประตูสู่ระบบจ้างงาน
	// Result persists the interview outcome. It used to live only inside a
	// notification message, which meant a student could not re-open the result
	// page and an employer could not tell whether a result had been sent yet.
	// empty = not announced, passed | failed
	Result            string     `gorm:"size:20" json:"result"`
	ResultComment     string     `gorm:"type:text" json:"result_comment"`
	ResultAnnouncedAt *time.Time `json:"result_announced_at"`

	// ความสัมพันธ์ (GORM โหลดเมื่อสั่ง Preload): ประวัติเลื่อนนัด (0..*) / เอกสาร (0..*) / ข้อตกลง (0..1) / แจ้งเตือน (0..*)
	// Relations
	Reschedules   []RescheduleInterview `gorm:"foreignKey:InterviewScheduleID" json:"reschedules,omitempty"`
	Documents     []Document            `gorm:"foreignKey:InterviewScheduleID" json:"documents,omitempty"`
	Agreement     *EmploymentAgreement  `gorm:"foreignKey:InterviewScheduleID" json:"agreement,omitempty"`
	Notifications []Notification        `gorm:"foreignKey:InterviewScheduleID" json:"notifications,omitempty"`
}

// ── RescheduleInterview : 1 แถว = 1 คำขอเลื่อนนัด (U3) ───────────────────────────────
//
//	RequestedBy = "student"  → นศ. เสนอ 1 เวลาใน StudentAvailableDateTime → ผู้ประกอบการตอบ
//	RequestedBy = "employer" → ผู้ประกอบการเสนอหลายเวลาใน ProposedSlots (ตารางลูก) → นศ. เลือก
//	Status: pending → accepted | rejected      RespondedAt = เวลาที่ตอบ (NULL ขณะรอ)
//	NewAppointmentDateTime = เวลาที่ตกลงกันได้ (กรอกเมื่อ accepted)
//
// RescheduleInterview records a request to change an interview time.
type RescheduleInterview struct {
	RescheduleID             uint       `gorm:"primaryKey" json:"reschedule_id"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`
	InterviewScheduleID      uint       `gorm:"not null;index" json:"interview_schedule_id"`
	StudentAvailableDateTime *time.Time `json:"student_available_date_time"`
	NewAppointmentDateTime   *time.Time `json:"new_appointment_date_time"`
	RescheduleReason         string     `gorm:"type:text" json:"reschedule_reason"`

	// RequestedBy distinguishes the two flows that share this table: the student
	// proposing their free slots, and the employer asking the student for theirs.
	// student | employer
	RequestedBy string `gorm:"size:20;not null;default:'student'" json:"requested_by"`

	// Status of the request itself. pending | accepted | rejected
	Status string `gorm:"size:50;not null;default:'pending'" json:"status"`

	// RespondedAt is when the request was settled — the employer approving or
	// rejecting the student's proposal, or the student picking one of the
	// employer's slots. Nil while the request is still pending.
	RespondedAt *time.Time `json:"responded_at"`

	// Relations. ProposedSlots is filled only by the employer flow — the
	// employer offers a few times and the student picks one, so there is
	// nothing for the employer to approve afterwards. Empty for
	// student-initiated requests.
	ProposedSlots []RescheduleProposedSlot `gorm:"foreignKey:RescheduleInterviewID" json:"proposed_slots,omitempty"`
	Notifications []Notification           `gorm:"foreignKey:RescheduleInterviewID" json:"notifications,omitempty"`
}

// ── RescheduleProposedSlot : ตารางลูกของ RescheduleInterview (1 ── 0..*) ──────────────
//
//	เดิมเก็บเป็น text คั่น comma ในคอลัมน์เดียว → แยกเป็นตารางเพื่อ query/index ได้ต่อเวลา
//	และให้ SelectRescheduleSlot เทียบ "เวลาที่ นศ. เลือก ∈ เวลาที่เสนอ" ด้วย SQL equality
//	SlotAt เป็น timestamptz (เก็บ instant จริง) ต่างจาก appointment_date/time ที่แยก 2 คอลัมน์
//
// RescheduleProposedSlot is one time an employer offered as part of a
// RescheduleInterview (RequestedBy="employer"). Previously these were joined
// into a single comma-separated text column on RescheduleInterview, which
// couldn't be queried or indexed per slot and relied on an exact string match
// (RFC3339 formatting included) to detect which one the student picked; a
// real column and a timestamptz equality check do that natively.
type RescheduleProposedSlot struct {
	SlotID                uint      `gorm:"primaryKey" json:"slot_id"`
	RescheduleInterviewID uint      `gorm:"not null;index" json:"reschedule_interview_id"`
	SlotAt                time.Time `gorm:"not null;index" json:"slot_at"`
}

// ── EmploymentAgreement : ข้อตกลงการจ้างงาน (U6/U7) ──────────────────────────────────
//
//	InterviewScheduleID (FK, NULL ได้) = นัดสัมภาษณ์ที่ข้อตกลงนี้เกิดจาก
//	  → บังคับลำดับ "ผ่านสัมภาษณ์ก่อน ค่อยจ้าง"  และ 1 นัด มีข้อตกลงได้ 0..1
//	เงื่อนไขสัญญา 6 ช่อง: StartDate, WageRate, DurationMonths, WorkingHours, LeavePolicy, AdditionalTerms
//	Status: pending → accepted (มีผลบังคับ) | rejected (+RejectReason) → void (ลบแบบเก็บหลักฐาน)
//	สัญญาหมดอายุ = StartDate + DurationMonths เดือน (คำนวณตอนใช้ ไม่เก็บซ้ำ)
//
// EmploymentAgreement is the contract between a Student and an Employer.
// Status isn't a literal diagram attribute, but is needed to persist the
// accept/reject decision — same pragmatic addition as Application.Status and
// Jobpost.Status elsewhere in this codebase (see t04_project_docs_reference).
type EmploymentAgreement struct {
	AgreementID         uint       `gorm:"primaryKey" json:"agreement_id"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	StudentID           uint       `gorm:"not null;index" json:"student_id"`
	EmployerID          uint       `gorm:"not null;index" json:"employer_id"`
	InterviewScheduleID *uint      `gorm:"index" json:"interview_schedule_id"` // interview this agreement stemmed from (per class diagram)
	StartDate           *time.Time `json:"start_date"`
	WageRate            float64    `gorm:"type:decimal(10,2)" json:"wage_rate"`
	DurationMonths      int        `gorm:"default:0" json:"duration_months"`
	WorkingHours        string     `gorm:"size:100" json:"working_hours"`
	LeavePolicy         string     `gorm:"type:text" json:"leave_policy"`
	AdditionalTerms     string     `gorm:"type:text" json:"additional_terms"`
	// pending | accepted | rejected | void. "void" is a soft delete (#10):
	// DeleteAgreement flips a rejected offer to void instead of removing the
	// row, so what was offered and why it was declined stays on file — it's
	// just excluded from ListMine and from the "one offer per interview" check.
	Status       string `gorm:"size:50;not null;default:'pending'" json:"status"`
	RejectReason string `gorm:"type:text" json:"reject_reason"`

	// Belongs-to
	InterviewSchedule *InterviewSchedule `gorm:"foreignKey:InterviewScheduleID" json:"interview_schedule,omitempty"`

	// Relations
	Payrolls      []Payroll      `gorm:"foreignKey:AgreementID" json:"payrolls,omitempty"`
	Documents     []Document     `gorm:"foreignKey:EmploymentAgreementID" json:"documents,omitempty"`
	Notifications []Notification `gorm:"foreignKey:EmploymentAgreementID" json:"notifications,omitempty"`
}

// ── Document : ไฟล์หลักฐานที่แนบได้ทั้งกับนัดสัมภาษณ์และข้อตกลง ───────────────────────
//
//	FK 2 ตัวเป็น NULL ได้ทั้งคู่ → เอกสารผูกกับฝั่งใดฝั่งหนึ่งหรือทั้งคู่ก็ได้
//	(Class Diagram: InterviewSchedule 1 ── 0..* Document, EmploymentAgreement 1 ── 0..* Document)
//	หมายเหตุ prototype รอบนี้: ตารางพร้อมแล้ว แต่การ generate ไฟล์สัญญายังไม่อยู่ใน scope
//
// Document is a contract file attached to an EmploymentAgreement (e.g. the signed
// agreement PDF), per B6733827's class diagram class 10 (subsystem 1) / class 2
// (subsystem 2) — the same Document class shared across both subsystems.
//
// Per the class diagram a Document links to both an InterviewSchedule and an
// EmploymentAgreement. InterviewScheduleID is nullable so a document can be tied
// back to the specific interview it originated from without requiring one.
type Document struct {
	DocumentID uint      `gorm:"primaryKey" json:"document_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	// Nullable so the history page can also list documents that belong to an
	// interview only (IV-xxxx) and not to any agreement (AG-xxxx).
	EmploymentAgreementID *uint      `gorm:"index" json:"employment_agreement_id"`
	InterviewScheduleID   *uint      `gorm:"index" json:"interview_schedule_id"`
	FileName              string     `gorm:"size:255;not null" json:"file_name"`
	File                  string     `gorm:"size:500" json:"file"` // URL / file path
	DocumentType          string     `gorm:"size:100" json:"document_type"`
	CreatedDate           *time.Time `json:"created_date"`
}
