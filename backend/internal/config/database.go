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

    // Seed initial data
    if err := SeedDatabase(db); err != nil {
        return nil, err
    }

    return db, nil
}
