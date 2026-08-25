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

    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return nil, err
    }

    if err := db.AutoMigrate(
        // Core users
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
