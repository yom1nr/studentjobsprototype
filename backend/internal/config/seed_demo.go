package config

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
	"gorm.io/gorm"
)

// demoSeedEnabled reports whether the extended demo dataset (extra employers,
// students and job posts on top of the three base accounts) should be loaded.
// Default on; set SEED_DEMO_DATA=false for a bare database.
func demoSeedEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("SEED_DEMO_DATA"))) {
	case "false", "0", "no", "off":
		return false
	default:
		return true
	}
}

const demoPassword = "demopass123"

var demoUniversities = []string{
	"มหาวิทยาลัยเทคโนโลยีสุรนารี",
	"มหาวิทยาลัยขอนแก่น",
	"มหาวิทยาลัยเชียงใหม่",
}

type demoEmployer struct {
	userName, email, firstName, lastName string
	company, businessType, taxID, addr   string
}

type demoStudent struct {
	userName, email, firstName, lastName string
	uniIdx                               int
	faculty, major, years                string
	skill, availableTime, gender, dob    string
}

type demoJob struct {
	employerIdx int
	position    string
	jobType     string
	description string
	wage        float64
	period      string
	quantity    int
}

var demoEmployers = []demoEmployer{
	{"emp_coffeelab", "employer1@demo.com", "สมชาย", "ใจดี", "CoffeeLab คาเฟ่", "ร้านอาหารและเครื่องดื่ม", "0105551000011", "ประตู 1 มทส."},
	{"emp_bookstore", "employer2@demo.com", "ปิยะ", "พาณิชย์", "SUT BookStore", "ค้าปลีก", "0105551000022", "อาคารเรียนรวม 1 มทส."},
	{"emp_grocer", "employer3@demo.com", "วีระ", "ศรีสุข", "Green Grocer", "ค้าปลีก", "0105551000033", "ประตู 4 มทส."},
	{"emp_techfix", "employer4@demo.com", "กมล", "วัฒนา", "TechFix ซ่อมคอม", "บริการไอที", "0105551000044", "ศูนย์เครื่องมือ 7 มทส."},
	{"emp_movemate", "employer5@demo.com", "ธนกร", "บุญมี", "MoveMate ขนส่ง", "โลจิสติกส์", "0105551000055", "ประตู 5 มทส."},
	{"emp_sunrise", "employer6@demo.com", "อรุณ", "ทองคำ", "Sunrise เบเกอรี่", "ร้านอาหารและเครื่องดื่ม", "0105551000066", "สุรสัมมนาคาร มทส."},
	{"emp_eventpro", "employer7@demo.com", "ณัฐพล", "แสงทอง", "EventPro รับจัดงาน", "อีเวนต์", "0105551000077", "อาคารกิจกรรมนักศึกษา มทส."},
	{"emp_cleanco", "employer8@demo.com", "พงษ์", "รักงาน", "CleanCo แม่บ้าน", "บริการทำความสะอาด", "0105551000088", "อาคารบริหาร มทส."},
	{"emp_tutorhub", "employer9@demo.com", "สุริยา", "ก้าวหน้า", "TutorHub ติวเตอร์", "การศึกษา", "0105551000099", "บรรณสาร มทส."},
	{"emp_farmfresh", "employer10@demo.com", "จิรายุ", "มั่งมี", "FarmFresh ฟาร์ม", "เกษตร", "0105551000100", "ฟาร์มมหาวิทยาลัย มทส."},
}

var demoStudents = []demoStudent{
	{"stud_thanawat", "student1@demo.com", "ธนวัฒน์", "อินทร์", 0, "สำนักวิชาวิศวกรรมศาสตร์", "วิศวกรรมคอมพิวเตอร์", "1", "MS Office, ทำงานเป็นทีม, สื่อสารดี", "จ-ศ หลัง 16:00, ส-อา ทั้งวัน", "ชาย", "2001-01-01"},
	{"stud_parichat", "student2@demo.com", "ปาริชาต", "สุขใจ", 0, "คณะวิทยาศาสตร์", "วิทยาการคอมพิวเตอร์", "2", "Python, วิเคราะห์ข้อมูล", "จ อ พ เช้า, เสาร์-อาทิตย์ ทั้งวัน", "หญิง", "2002-02-02"},
	{"stud_supakorn", "student3@demo.com", "ศุภกร", "พงศ์ดี", 0, "คณะบริหารธุรกิจ", "การตลาด", "3", "งานขาย, โซเชียลมีเดีย", "อ พฤ บ่าย, ส-อา", "ชาย", "2003-03-03"},
	{"stud_kan", "student4@demo.com", "กานต์", "รุ่งเรือง", 0, "สำนักวิชาวิศวกรรมศาสตร์", "วิศวกรรมโยธา", "4", "AutoCAD, หน้างานก่อสร้าง", "ทุกวันหลังเลิกเรียน ช่วงเย็น", "หญิง", "2000-04-04"},
	{"stud_napat", "student5@demo.com", "นภัสสร", "ทรัพย์ดี", 1, "คณะวิทยาศาสตร์", "สถิติ", "1", "Excel, R, จัดการเอกสาร", "เฉพาะเสาร์-อาทิตย์", "หญิง", "2001-05-05"},
	{"stud_thitipong", "student6@demo.com", "ฐิติพงษ์", "ไชยวงศ์", 1, "สำนักวิชาวิศวกรรมศาสตร์", "วิศวกรรมคอมพิวเตอร์", "2", "React, Go, Git", "จ-ศ หลัง 16:00", "ชาย", "2002-06-06"},
	{"stud_wannida", "student7@demo.com", "วรรณิดา", "ประเสริฐ", 1, "คณะบริหารธุรกิจ", "การตลาด", "3", "คอนเทนต์, ถ่ายภาพ", "ส-อา ทั้งวัน", "หญิง", "2003-07-07"},
	{"stud_apisit", "student8@demo.com", "อภิสิทธิ์", "ตั้งใจ", 2, "คณะวิทยาศาสตร์", "วิทยาการคอมพิวเตอร์", "4", "Java, ฐานข้อมูล", "จ พ ศ บ่าย", "ชาย", "2000-08-08"},
	{"stud_chanakan", "student9@demo.com", "ชนากานต์", "วิไล", 2, "คณะบริหารธุรกิจ", "การตลาด", "1", "งานลูกค้าสัมพันธ์", "ทุกวันช่วงเย็น", "หญิง", "2001-09-09"},
	{"stud_phurich", "student10@demo.com", "ภูริช", "เดชา", 2, "สำนักวิชาวิศวกรรมศาสตร์", "วิศวกรรมโยธา", "2", "สำรวจ, เขียนแบบ", "เฉพาะเสาร์-อาทิตย์", "ชาย", "2002-10-10"},
}

var demoJobs = []demoJob{
	{0, "บาริสต้าพาร์ทไทม์", "บริการ", "ชงกาแฟ รับออร์เดอร์ ดูแลความสะอาดหน้าร้าน", 55, "กะเช้า จ-ศ 07:00-12:00", 2},
	{0, "พนักงานเสิร์ฟช่วงเย็น", "บริการ", "เสิร์ฟอาหาร เก็บโต๊ะ ช่วงเย็น", 50, "กะเย็น 16:00-20:00 ทุกวัน", 3},
	{1, "ผู้ช่วยร้านหนังสือ", "ค้าปลีก", "จัดชั้นหนังสือ คิดเงิน ช่วยลูกค้า", 48, "เสาร์-อาทิตย์ 09:00-17:00", 2},
	{2, "พนักงานจัดของ", "ค้าปลีก", "จัดเรียงสินค้า เช็คสต็อก ตอนเช้า", 45, "กะเช้า จ พ ศ", 2},
	{3, "ผู้ช่วยเทคนิคคอมพิวเตอร์", "ไอที", "ลงโปรแกรม ประกอบเครื่อง แก้ปัญหาเบื้องต้น", 70, "จ-ศ บ่าย 13:00-17:00", 1},
	{5, "ผู้ช่วยเบเกอรี่", "บริการ", "แพ็คขนม ติดป้ายราคา ช่วงเช้า", 50, "กะเช้า ส-อา", 2},
	{6, "สตาฟงานอีเวนต์", "อีเวนต์", "ต้อนรับผู้ร่วมงาน ดูแลจุดลงทะเบียน", 60, "เสาร์-อาทิตย์ เป็นครั้งคราว", 5},
	{8, "ติวเตอร์คณิต ม.ปลาย", "การศึกษา", "สอนพิเศษคณิตศาสตร์ ม.4-ม.6 ตัวต่อตัว", 120, "จ-พฤ เย็น 17:00-19:00", 3},
}

// seedDemoData loads the extended demo dataset: 10 approved employers across the
// SUT campus, 10 students across three universities, and a handful of open job
// posts. Every step is idempotent (keyed by email / owner) so it is safe to run
// on every boot.
func seedDemoData(db *gorm.DB) error {
	if !demoSeedEnabled() {
		return nil
	}

	hashed, err := utils.HashPassword(demoPassword)
	if err != nil {
		return err
	}

	// Employer id per index, so jobs can be attached to the right owner.
	employerUserID := make(map[int]uint, len(demoEmployers))

	for i, e := range demoEmployers {
		user, err := ensureDemoUser(db, e.userName, e.email, hashed, "employer", "")
		if err != nil {
			return err
		}
		employerUserID[i] = user.UserID

		var employer models.Employer
		if err := db.Where(models.Employer{UserID: user.UserID}).
			Attrs(models.Employer{
				FirstName:      e.firstName,
				LastName:       e.lastName,
				Position:       "เจ้าของกิจการ",
				CompanyName:    e.company,
				BusinessType:   e.businessType,
				TaxID:          e.taxID,
				CompanyAddress: e.addr,
			}).
			FirstOrCreate(&employer).Error; err != nil {
			return fmt.Errorf("seed demo employer %s: %w", e.email, err)
		}

		var approve models.Approve
		if err := db.Where(models.Approve{UserID: user.UserID}).
			Attrs(models.Approve{DateOfSignUp: time.Now().UTC(), Status: "approved"}).
			FirstOrCreate(&approve).Error; err != nil {
			return fmt.Errorf("seed demo approve %s: %w", e.email, err)
		}
	}

	for _, s := range demoStudents {
		user, err := ensureDemoUser(db, s.userName, s.email, hashed, "student", s.gender)
		if err != nil {
			return err
		}

		var dob *time.Time
		if t, perr := time.Parse("2006-01-02", s.dob); perr == nil {
			dob = &t
		}
		uni := demoUniversities[s.uniIdx%len(demoUniversities)]
		var student models.Student
		if err := db.Where(models.Student{UserID: user.UserID}).
			Attrs(models.Student{
				FirstName:     s.firstName,
				LastName:      s.lastName,
				DateOfBirth:   dob,
				Address:       "หอพักนักศึกษา " + uni,
				University:    uni,
				Faculty:       s.faculty,
				Major:         s.major,
				Years:         s.years,
				Skill:         s.skill,
				AvailableTime: s.availableTime,
			}).
			FirstOrCreate(&student).Error; err != nil {
			return fmt.Errorf("seed demo student %s: %w", s.email, err)
		}
	}

	for _, j := range demoJobs {
		ownerID, ok := employerUserID[j.employerIdx]
		if !ok {
			continue
		}
		var job models.Jobpost
		if err := db.Where(models.Jobpost{UserID: ownerID, Position: j.position}).
			Attrs(models.Jobpost{
				JobID:          fmt.Sprintf("DEMO-%d", ownerID),
				JobType:        j.jobType,
				JobDescription: j.description,
				Wage:           j.wage,
				Period:         j.period,
				Location:       demoEmployers[j.employerIdx].addr,
				Welfare:        "มีอาหารกลางวัน",
				Quantity:       j.quantity,
				Status:         "open",
			}).
			FirstOrCreate(&job).Error; err != nil {
			return fmt.Errorf("seed demo job %q: %w", j.position, err)
		}
	}

	log.Printf("demo dataset ready: %d employers, %d students, %d job posts",
		len(demoEmployers), len(demoStudents), len(demoJobs))
	return nil
}

// ensureDemoUser returns the user with the given email, creating it first if it
// does not exist.
func ensureDemoUser(db *gorm.DB, userName, email, hashedPassword, role, gender string) (*models.User, error) {
	var user models.User
	if err := db.Where(models.User{Email: email}).
		Attrs(models.User{
			UserName: userName,
			Password: hashedPassword,
			Gender:   gender,
			Role:     role,
		}).
		FirstOrCreate(&user).Error; err != nil {
		return nil, fmt.Errorf("seed demo user %s: %w", email, err)
	}
	return &user, nil
}
