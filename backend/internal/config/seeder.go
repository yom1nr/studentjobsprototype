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

	// Extended demo dataset (10 employers / 10 students / job posts). Skipped
	// when SEED_DEMO_DATA=false.
	if err := seedDemoData(db); err != nil {
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
