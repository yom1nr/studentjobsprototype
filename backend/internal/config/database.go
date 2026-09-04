package config

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/models"
)

// ConnectDatabase opens a PostgreSQL connection and runs migrations.
func ConnectDatabase(cfg *Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		cfg.DBHost,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBName,
		cfg.DBPort,
	)

	// Student/Employer/Admin now share User's primary key (UserID) via a
	// belongs-to relation declared on both sides. GORM's AutoMigrate follows
	// that association recursively while still migrating User itself, so it
	// can try to create e.g. "admins" with a FOREIGN KEY REFERENCES "users"
	// before the "users" table exists yet, regardless of call order. Disabling
	// FK constraint creation during migration sidesteps that; referential
	// integrity for these is already enforced at the application layer.
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Student{},
		&models.Employer{},
		&models.Admin{},
		// Attachments & approval
		&models.AttachmentStudent{},
		&models.AttachmentEmployer{},
		&models.Approve{},
		// Job posting & application
		&models.Jobpost{},
		&models.Application{},
		&models.ApplicationAudit{},
		&models.ApplicationDocument{},
		// Admin audit trail
		&models.AdminAuditLog{},
		// Complaint
		&models.Complaint{},
		&models.ComplaintHistory{},
		&models.Attachment{},
		// Interview & agreement
		&models.InterviewSchedule{},
		&models.RescheduleInterview{},
		&models.EmploymentAgreement{},
		&models.Document{},
		// Time tracking & payroll
		&models.TimeRecord{},
		&models.TimeEditRequest{},
		&models.Payroll{},
		&models.Payslip{},
		// Notifications
		&models.Notification{},
	); err != nil {
		return nil, err
	}

	if err := ensureUniqueIndexes(db); err != nil {
		return nil, err
	}

	// Seed initial data
	if err := SeedDatabase(db); err != nil {
		return nil, err
	}

	return db, nil
}

// ensureUniqueIndexes creates the partial unique indexes GORM's struct tags
// can't express (a UNIQUE constraint scoped by a WHERE clause). The
// application already refuses a second employment agreement for the same
// interview, and a second open reschedule request for the same interview, by
// checking-then-writing — which two near-simultaneous requests can both pass.
// These indexes make the database itself the source of truth for both
// invariants, so a race lands on one row inserted and one 23505 (see
// utils.IsUniqueViolation), never two rows.
func ensureUniqueIndexes(db *gorm.DB) error {
	stmts := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_employment_agreements_interview_unique
            ON employment_agreements (interview_schedule_id)
            WHERE interview_schedule_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_reschedule_interviews_pending_unique
            ON reschedule_interviews (interview_schedule_id)
            WHERE status = 'pending'`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}
	return nil
}
