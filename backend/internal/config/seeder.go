package config

import (
	"log"
	"time"

	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/utils"
	"gorm.io/gorm"
)

// SeedDatabase populates the database with initial data.
func SeedDatabase(db *gorm.DB) error {
	log.Println("Starting database seed...")

	// Seed Users
	if err := seedUsers(db); err != nil {
		return err
	}

	// Seed an admin account so the employer-approval flow is testable immediately.
	if err := seedAdmin(db); err != nil {
		return err
	}

	// Seed a pending employer profile for the seeded employer test user, so the
	// admin approval queue has something to review out of the box.
	if err := seedEmployerProfile(db); err != nil {
		return err
	}

	// Seed job posts so students can test part-time job matching and applications.
	if err := seedJobposts(db); err != nil {
		return err
	}

	log.Println("Database seed completed successfully")
	return nil
}

// seedUsers creates initial user records.
func seedUsers(db *gorm.DB) error {
	hashedPassword1, err := utils.HashPassword("password123")
	if err != nil {
		return err
	}

	hashedPassword2, err := utils.HashPassword("securepass456")
	if err != nil {
		return err
	}

	users := []models.User{
		{
			UserName: "somchai",
			Email:    "somchai@example.com",
			Password: hashedPassword1,
			Gender:   "ชาย",
			Role:     "student",
		},
		{
			UserName: "somying",
			Email:    "somying@example.com",
			Password: hashedPassword2,
			Gender:   "หญิง",
			Role:     "employer",
		},
	}

	for _, user := range users {
		// Check if user already exists by email
		var existing models.User
		if err := db.Where("email = ?", user.Email).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&user).Error; err != nil {
					log.Printf("failed to seed user: %v", err)
					return err
				}
				log.Printf("created user: %s (%s)", user.UserName, user.Email)
			} else {
				return err
			}
		}
	}

	return nil
}

// seedAdmin creates a university-staff account that can review employer registrations.
func seedAdmin(db *gorm.DB) error {
	email := "sompong@example.com"

	var user models.User
	err := db.Where("email = ?", email).First(&user).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}

		hashedPassword, err := utils.HashPassword("adminpass789")
		if err != nil {
			return err
		}

		user = models.User{
			UserName: "sompong",
			Email:    email,
			Password: hashedPassword,
			Gender:   "ชาย",
			Role:     "admin",
		}
		if err := db.Create(&user).Error; err != nil {
			log.Printf("failed to seed admin user: %v", err)
			return err
		}
		log.Printf("created user: %s (%s)", user.UserName, user.Email)
	}

	var admin models.Admin
	err = db.Where("user_id = ?", user.UserID).First(&admin).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}

		admin = models.Admin{
			UserID:     user.UserID,
			FirstName:  "สมปอง",
			LastName:   "ดูแลระบบ",
			Position:   "เจ้าหน้าที่ทะเบียน",
			Enterprise: "มหาวิทยาลัยเทคโนโลยีสุรนารี",
			Department: "งานทะเบียนและประมวลผล",
		}
		if err := db.Create(&admin).Error; err != nil {
			log.Printf("failed to seed admin profile: %v", err)
			return err
		}
		log.Printf("created admin profile for: %s", user.Email)
	}

	return nil
}

// seedEmployerProfile gives the seeded employer test user a company profile with
// a pending Approve record, so /api/v1/admin/employers?status=pending isn't empty.
func seedEmployerProfile(db *gorm.DB) error {
	var user models.User
	if err := db.Where("email = ?", "somying@example.com").First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	var employer models.Employer
	err := db.Where("user_id = ?", user.UserID).First(&employer).Error
	if err == nil {
		return nil // already seeded
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}

	employer = models.Employer{
		UserID:         user.UserID,
		FirstName:      "สมหญิง",
		LastName:       "ใจดี",
		Position:       "เจ้าของร้าน",
		CompanyName:    "ร้านกาแฟสมหญิง",
		BusinessType:   "คาเฟ่",
		TaxID:          "1234567890123",
		CompanyAddress: "111 ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง จ.นครราชสีมา 30000",
	}
	if err := db.Create(&employer).Error; err != nil {
		log.Printf("failed to seed employer profile: %v", err)
		return err
	}

	approve := models.Approve{
		UserID:       employer.UserID,
		DateOfSignUp: time.Now().UTC(),
		Status:       "pending",
	}
	if err := db.Create(&approve).Error; err != nil {
		log.Printf("failed to seed approve record: %v", err)
		return err
	}

	log.Printf("created pending employer profile for: %s", user.Email)
	return nil
}

// seedJobposts inserts initial mock job posts into PostgreSQL.
func seedJobposts(db *gorm.DB) error {
	var user models.User
	if err := db.Where("email = ?", "somying@example.com").First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	now := time.Now().UTC()
	jobposts := []models.Jobpost{
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-001",
			CompanyName:    "ร้านกาแฟ Somหญิง Café มทส.",
			Position:       "พนักงานพาร์ทไทม์ ร้านคาเฟ่ (Barista & Cashier)",
			JobType:        "งานร้านอาหาร/คาเฟ่",
			JobDescription: "รับสมัครพนักงานชงกาแฟและแคชเชียร์ ดูแลลูกค้า ชงเครื่องดื่มเสิร์ฟ และดูแลความสะอาดร้าน ชั่วโมงละ 75 บาท ทำงานวันละ 4-6 ชั่วโมง มีเวลาว่างช่วงเย็นหรือวันเสาร์-อาทิตย์",
			DateStart:      &now,
			Wage:           75.00,
			Period:         "3 เดือน",
			Location:       "ร้านกาแฟสมหญิง อาคารกิจกรรมนักศึกษา มทส.",
			Welfare:        "ส่วนลดเครื่องดื่ม 50%, ชุดพนักงานฟรี, เบี้ยขยัน",
			Property:       "นักศึกษามหาวิทยาลัย ทุกชั้นปี มีมนุษยสัมพันธ์ดี ยิ้มแย้มแจ่มใส",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-002",
			CompanyName:    "สำนักวิชาเทคโนโลยีสังคม มทส.",
			Position:       "ผู้ช่วยวิจัยและจัดทำเอกสาร (Research Assistant)",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "ช่วยอาจารย์รวบรวมข้อมูล รวบรวมสถิติ บันทึกข้อมูลลง Excel และประสานงานจัดเตรียมห้องประชุม สามารถเลือกเวลาทำงานที่ตรงกับเวลาว่างจากการเรียนได้",
			DateStart:      &now,
			Wage:           85.00,
			Period:         "1 เทอม",
			Location:       "อาคารสิรินธรวิทยารมย์ สำนักวิชาเทคโนโลยีสังคม",
			Welfare:        "ใบรับรองการทำงาน (Certificate), อาหารว่างประจำวัน",
			Property:       "ใช้โปรแกรม MS Office/Excel ได้ดี มีความรับผิดชอบตรงต่อเวลา",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-003",
			CompanyName:    "ร้านมินิมาร์ทและคลังสินค้า SUT",
			Position:       "พนักงานจัดสต็อกและแพ็คสินค้าพาร์ทไทม์",
			JobType:        "งานคลังสินค้า/จัดส่ง",
			JobDescription: "ช่วยตรวจรับสินค้า จัดเรียงสินค้าตามชั้น ตรวจนับสต็อก และแพ็คสินค้าสำหรับจัดส่งตามคำสั่งซื้อ ทำงานช่วงเย็น 17.00 - 21.00 น.",
			DateStart:      &now,
			Wage:           80.00,
			Period:         "2 เดือน",
			Location:       "ร้านมินิมาร์ทและคลังสินค้า ประตู 1 มทส.",
			Welfare:        "ค่าล่วงเวลา (OT), โบนัสปิดเทอม",
			Property:       "ขยัน อดทน ซื่อสัตย์ ไม่จำกัดเพศ",
			Quantity:       4,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-004",
			CompanyName:    "ศูนย์บรรณสารและสื่อการศึกษา มทส.",
			Position:       "พนักงานบริการลูกค้าและเฝ้าห้องสมุด (Library Assistant)",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "ดูแลเคาน์เตอร์ยืม-คืนหนังสือ จัดเรียงหนังสือเข้าชั้น ให้บริการข้อมูลแก่นักศึกษา และดูแลความเรียบร้อยในพื้นที่บรรยากาศเงียบสงบ",
			DateStart:      &now,
			Wage:           70.00,
			Period:         "1 เทอม",
			Location:       "อาคารบรรณสารและสื่อการศึกษา มทส. (ประตู 4)",
			Welfare:        "อินเทอร์เน็ตความเร็วสูง, ชั่วโมงจิตอาสา/กิจกรรม",
			Property:       "นักศึกษามหาวิทยาลัย รักการอ่าน ซื่อสัตย์ สุภาพเรียบร้อย",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-005",
			CompanyName:    "ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี มทส.",
			Position:       "ผู้ช่วยช่างภาพและแอดมินเพจสื่อมวลชน มทส.",
			JobType:        "งานสื่อ/กราฟิก",
			JobDescription: "ช่วยถ่ายภาพกิจกรรมมหาวิทยาลัย แต่งภาพเบื้องต้น ตกแต่งคอนเทนต์ และตอบข้อความเพจสื่อประชาสัมพันธ์นักศึกษา ทำงานตามรอบกิจกรรม",
			DateStart:      &now,
			Wage:           90.00,
			Period:         "4 เดือน",
			Location:       "ศูนย์เครื่องมือวิทยาศาสตร์และเทคโนโลยี มทส. (ประตู 5)",
			Welfare:        "ค่าอุปกรณ์/เบี้ยเลี้ยงออกถ่ายภาพนอกสถานที่, ประกาศนียบัตรผลงาน",
			Property:       "ใช้อุปกรณ์กล้องหรือโปรแกรม Canva/Photoshop เบื้องต้นได้",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-006",
			CompanyName:    "ศูนย์ห้องปฏิบัติการวิทยากายภาพ มทส.",
			Position:       "ผู้ช่วยงานทดลองห้องปฏิบัติการวิทยากายภาพ",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "จัดเตรียมอุปกรณ์การทดลอง ทำความสะอาดเครื่องแก้ว ดูแลความเรียบร้อยในห้องแล็บเคมีและฟิสิกส์",
			DateStart:      &now,
			Wage:           85.00,
			Period:         "1 เทอม",
			Location:       "อาคารเครื่องมือวิทยาศาสตร์ B มทส.",
			Welfare:        "เสื้อกาวน์ปฏิบัติการ, อุปกรณ์ความปลอดภัยครบชุด",
			Property:       "นักศึกษาคณะวิทยาศาสตร์ หรือวิศวกรรมศาสตร์ มีความละเอียดรอบคอบ",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-007",
			CompanyName:    "ร้านอาหารไทย-อีสาน SUT Village",
			Position:       "พนักงานเสิร์ฟและต้อนรับ ร้านอาหารไทย-อีสาน",
			JobType:        "งานร้านอาหาร/คาเฟ่",
			JobDescription: "รับออเดอร์ เสิร์ฟอาหาร แนะนำเมนูอาหาร และรับชำระเงินที่เคาน์เตอร์ ทำงานกะเย็น 16.30 - 21.30 น.",
			DateStart:      &now,
			Wage:           75.00,
			Period:         "2 เดือน",
			Location:       "โซนหอพักนักศึกษา SUT Village (ประตู 1 มทส.)",
			Welfare:        "อาหารเย็นฟรี 1 มื้อ, ทิปรวมประจำสัปดาห์",
			Property:       "สุภาพ อดทน ยิ้มแย้มแจ่มใส มีใจรักงานบริการ",
			Quantity:       4,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-008",
			CompanyName:    "สำนักวิชาวิศวกรรมศาสตร์ มทส.",
			Position:       "ติวเตอร์ช่วยสอนการเขียนโปรแกรม Python / C++",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "ช่วยเฉลยแบบฝึกหัด แนะนำแนวทางการแก้บั๊กโปรแกรมแก่นักศึกษาชั้นปีที่ 1 ในรายวิชา Computer Programming",
			DateStart:      &now,
			Wage:           120.00,
			Period:         "1 เทอม",
			Location:       "สำนักวิชาวิศวกรรมศาสตร์ มทส.",
			Welfare:        "เกียรติบัตรผู้ช่วยสอน (TA), ห้องทำงานปรับอากาศ",
			Property:       "นักศึกษาชั้นปีที่ 2 ขึ้นไป มีผลการเรียนดีวิชา Programming",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-009",
			CompanyName:    "ร้านสะดวกซื้อ 24 ชม. ประตู 4",
			Position:       "เจ้าหน้าที่ตรวจนับสินค้ามินิมาร์ทกะดึก",
			JobType:        "งานคลังสินค้า/จัดส่ง",
			JobDescription: "เติมสินค้าบนชั้นวาง ตรวจเช็กวันหมดอายุ เช็กสต็อกสินค้าประจำวัน ทำงานช่วง 20.00 - 24.00 น.",
			DateStart:      &now,
			Wage:           85.00,
			Period:         "3 เดือน",
			Location:       "ร้านสะดวกซื้อ 24 ชม. ประตู 4 มทส.",
			Welfare:        "เบี้ยเลี้ยงกะดึก, เครื่องดื่มฟรี",
			Property:       "ขยัน ตรงต่อเวลา สามารถทำงานกะดึกได้",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-010",
			CompanyName:    "ฟาร์มมหาวิทยาลัย เทคโนโลยีการเกษตร",
			Position:       "ผู้ช่วยดูแลฟาร์มทดสอบและพืชสวนเกษตร",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "ช่วยรดน้ำ ให้ปุ๋ย เก็บเกี่ยวผลผลิตพืชทดลอง และจดบันทึกการเจริญเติบโตของพืช ทำงานช่วงเช้า 07.00 - 09.00 น.",
			DateStart:      &now,
			Wage:           80.00,
			Period:         "2 เดือน",
			Location:       "ฟาร์มมหาวิทยาลัย สำนักวิชาเทคโนโลยีการเกษตร",
			Welfare:        "ผลผลิตเกษตรปลอดภัยแบ่งปันประจำสัปดาห์",
			Property:       "ชอบงานกลางแจ้ง ขยัน อดทน มีความรับผิดชอบ",
			Quantity:       5,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-011",
			CompanyName:    "ศูนย์บริการคาร์แคร์ ประตู 1",
			Position:       "พนักงานล้างรถและคาร์แคร์พาร์ทไทม์",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "ฉีดน้ำล้างทำความสะอาดรถยนต์ เช็ดแห้ง ดูดฝุ่นภายในรถยนต์ ทำงานวันเสาร์-อาทิตย์ 09.00 - 17.00 น.",
			DateStart:      &now,
			Wage:           80.00,
			Period:         "3 เดือน",
			Location:       "ศูนย์บริการรถยนต์ใกล้ประตู 1 มทส.",
			Welfare:        "ค่าน้ำดื่มประจำวัน, ค่าคอมมิชชันตามจำนวนคัน",
			Property:       "ขยัน สุขภาพแข็งแรง ไม่จำกัดเพศ",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-012",
			CompanyName:    "ศูนย์นวัตกรรมและเทคโนโลยีการเรียนรู้",
			Position:       "กราฟิกดีไซเนอร์พาร์ทไทม์ (ออกแบบแบนเนอร์กิจกรรม)",
			JobType:        "งานสื่อ/กราฟิก",
			JobDescription: "ออกแบบโปสเตอร์ โปสเตอร์ประชาสัมพันธ์ภาพกิจกรรม และอินโฟกราฟิกสำหรับลงสื่อโซเชียลมีเดียของมหาวิทยาลัย",
			DateStart:      &now,
			Wage:           100.00,
			Period:         "1 เทอม",
			Location:       "ศูนย์นวัตกรรมและเทคโนโลยีการเรียนรู้ มทส.",
			Welfare:        "ทำงานแบบ Remote/Hybrid ได้, สะสม Portfolio งานจริง",
			Property:       "ใช้ Photoshop, Illustrator หรือ Canva ได้เป็นอย่างดี",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-013",
			CompanyName:    "อาคารสุรสัมมนาคาร & SUT Sport Club",
			Position:       "เจ้าหน้าที่ต้อนรับฟิตเนสและสระว่ายน้ำ",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "ตรวจสอบบัตรสมาชิกร่วมใช้งาน ดูแลความเรียบร้อยอุปกรณ์ออกกำลังกาย แจกผ้าขนหนูและให้คำแนะนำเบื้องต้น",
			DateStart:      &now,
			Wage:           75.00,
			Period:         "3 เดือน",
			Location:       "อาคารสุรสัมมนาคารและสปอร์ตคลับ มทส.",
			Welfare:        "เข้าใช้บริการฟิตเนสและสระว่ายน้ำฟรี",
			Property:       "บุคลิกภาพดี มีใจรักการออกกำลังกายและงานบริการ",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-014",
			CompanyName:    "ส่วนสารบรรณและงานบริหาร มทส.",
			Position:       "พนักงานจัดส่งเอกสารและพัสดุภายในมหาวิทยาลัย",
			JobType:        "งานคลังสินค้า/จัดส่ง",
			JobDescription: "คัดแยกเอกสารและหนังสือราชการ จัดส่งไปยังสำนักวิชาและหน่วยงานต่างๆ ภายในพื้นที่มหาวิทยาลัยเทคโนโลยีสุรนารี",
			DateStart:      &now,
			Wage:           75.00,
			Period:         "2 เดือน",
			Location:       "อาคารบริหาร มทส.",
			Welfare:        "ค่าน้ำมันจักรยานยนต์/รถจักรยานไฟฟ้า",
			Property:       "มีรถจักรยานยนต์หรือรถจักรยาน รู้จักเส้นทางภายใน มทส. ดี",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-015",
			CompanyName:    "ศูนย์ภาษา มทส. (SUT Language Center)",
			Position:       "ผู้ช่วยแปลภาษาและสรุปบทความวิชาการ",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "แปลเอกสารบทความวิชาการภาษาอังกฤษเป็นภาษาไทย และเรียบเรียงสรุปประเด็นสำคัญสำหรับใช้ในการประชุม",
			DateStart:      &now,
			Wage:           110.00,
			Period:         "1 เทอม",
			Location:       "ศูนย์ภาษา สำนักวิชาเทคโนโลยีสังคม มทส.",
			Welfare:        "ทำงานยืดหยุ่นตามกำหนดส่งงาน (Flexible Hours)",
			Property:       "ทักษะภาษาอังกฤษอยู่ในเกณฑ์ดีเยี่ยม (TOEIC 650+ หรือเทียบเท่า)",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-016",
			CompanyName:    "ร้านเบเกอรี่อบสด ประตู 4",
			Position:       "พนักงานเบเกอรี่และอบขนมปังยามเช้า",
			JobType:        "งานร้านอาหาร/คาเฟ่",
			JobDescription: "ช่วยนวดแป้ง ขึ้นรูปขนมปัง อบขนมเบเกอรี่สดใหม่ และจัดบรรจุใส่ถุงพร้อมจำหน่ายช่วงเช้า 06.00 - 09.00 น.",
			DateStart:      &now,
			Wage:           80.00,
			Period:         "3 เดือน",
			Location:       "ร้านขนมเบเกอรี่ ประตู 4 มทส.",
			Welfare:        "ขนมเบเกอรี่สดใหม่ฟรีทุกวันที่ทำงาน",
			Property:       "ตื่นเช้า ขยัน สะอาด ถูกสุขอนามัย",
			Quantity:       2,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-017",
			CompanyName:    "ศูนย์คอมพิวเตอร์และสารสนเทศ มทส.",
			Position:       "ผู้ช่วยงานวิเคราะห์ข้อมูล Data Entry",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "ป้อนข้อมูลแบบสอบถามงานวิจัย ตรวจสอบความถูกต้องของข้อมูลในระบบฐานข้อมูล และจัดทำรายงานสรุปประจำสัปดาห์",
			DateStart:      &now,
			Wage:           85.00,
			Period:         "1 เทอม",
			Location:       "อาคารคอมพิวเตอร์และศูนย์สารสนเทศ มทส.",
			Welfare:        "อบรมเทคนิคการใช้ซอฟต์แวร์วิเคราะห์ข้อมูลฟรี",
			Property:       "พิมพ์สัมผัสได้เร็ว ละเอียดรอบคอบ ไม่ละทิ้งงาน",
			Quantity:       4,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-018",
			CompanyName:    "ศูนย์กีฬาและนันทนาการ มทส.",
			Position:       "พนักงานดูแลสต็อกและเคาน์เตอร์อุปกรณ์กีฬา",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "ให้ยืม-คืนอุปกรณ์กีฬา ตรวจเช็กสภาพลูกบอล ไม้แบดมินตัน และดูแลความเรียบร้อยในโรงฝึกกีฬา",
			DateStart:      &now,
			Wage:           75.00,
			Period:         "2 เดือน",
			Location:       "อาคารสนามกีฬาและนันทนาการ มทส.",
			Welfare:        "สวัสดิการใช้สนามกีฬานอกเวลาการทำงาน",
			Property:       "อัธยาศัยดี ตรงต่อเวลา ซื่อสัตย์",
			Quantity:       3,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-019",
			CompanyName:    "อาคารสุรนิทัศน์ มทส.",
			Position:       "เจ้าหน้าที่ลงทะเบียนและจัดสถานที่สัมมนา",
			JobType:        "งานบริการ/สถานที่",
			JobDescription: "จัดเตรียมเก้าอี้และไมโครโฟน ลงทะเบียนผู้เข้าร่วมงาน ต้อนรับวิทยากร และดูแลความเรียบร้อยระหว่างการสัมมนา",
			DateStart:      &now,
			Wage:           80.00,
			Period:         "1 เทอม",
			Location:       "อาคารสุรนิทัศน์ มทส.",
			Welfare:        "อาหารกลางวันและอาหารว่างฟรีตลอดงาน",
			Property:       "คล่องแคล่ว มีไหวพริบ แก้ไขปัญหาเฉพาะหน้าได้ดี",
			Quantity:       5,
			Status:         "open",
		},
		{
			UserID:         user.UserID,
			JobID:          "JOB-2026-020",
			CompanyName:    "สำนักงานอธิการบดี มทส.",
			Position:       "ผู้ช่วยธุรการและประสานงานศิษย์เก่าสัมพันธ์",
			JobType:        "งานวิชาการ/ธุรการ",
			JobDescription: "อัปเดตข้อมูลการติดต่อศิษย์เก่า ประสานงานจดหมายข่าว จัดเตรียมของระลึก และรับสายโทรศัพท์สอบถามข้อมูล",
			DateStart:      &now,
			Wage:           85.00,
			Period:         "3 เดือน",
			Location:       "สำนักงานอธิการบดี มทส.",
			Welfare:        "ประสบการณ์งานเอกสารและงานประสานงานองค์กรใหญ่",
			Property:       "มนุษยสัมพันธ์ดี สื่อสารชัดเจน ใช้คอมพิวเตอร์พื้นฐานได้",
			Quantity:       2,
			Status:         "open",
		},
	}

	for _, j := range jobposts {
		var existing models.Jobpost
		if err := db.Where("job_id = ?", j.JobID).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&j).Error; err != nil {
					log.Printf("failed to seed jobpost: %v", err)
					return err
				}
				log.Printf("created jobpost: %s (%s)", j.Position, j.JobID)
			} else {
				return err
			}
		} else {
			db.Model(&existing).Update("company_name", j.CompanyName)
		}
	}

	return nil
}
