package main

import (
    "fmt"
    "log"
    "os"

    "github.com/joho/godotenv"

    "github.com/SA/Golang-Backend-Example/internal/config"
    "github.com/SA/Golang-Backend-Example/internal/controllers"
    "github.com/SA/Golang-Backend-Example/internal/routes"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

func main() {
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found, reading configuration from environment")
    }

    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatalf("failed to load configuration: %v", err)
    }

    db, err := config.ConnectDatabase(cfg)
    if err != nil {
        log.Fatalf("failed to connect to database: %v", err)
    }

    jwtProvider := utils.NewJWTProvider(cfg.JWTSecret, cfg.JWTExpiresIn)

    authController := controllers.NewAuthController(db, jwtProvider)
    userController := controllers.NewUserController(db)
    employerController := controllers.NewEmployerController(db)
    adminController := controllers.NewAdminController(db)
    notificationController := controllers.NewNotificationController(db)
    jobpostController := controllers.NewJobpostController(db)
    studentController := controllers.NewStudentController(db)
    applicationController := controllers.NewApplicationController(db)
    interviewController := controllers.NewInterviewController(db)
    employmentController := controllers.NewEmploymentController(db)
    timeRecordController := controllers.NewTimeRecordController(db)
    payrollController := controllers.NewPayrollController(db)
    complaintController := controllers.NewComplaintController(db)
    uploadController := controllers.NewUploadController()

    router := routes.SetupRouter(
        db,
        jwtProvider,
        authController,
        userController,
        employerController,
        adminController,
        notificationController,
        jobpostController,
        studentController,
        applicationController,
        interviewController,
        employmentController,
        timeRecordController,
        payrollController,
        complaintController,
        uploadController,
    )

    // Uploaded files are stored on disk and served read-only at /uploads.
    if err := os.MkdirAll("uploads", 0o755); err != nil {
        log.Printf("could not create uploads dir: %v", err)
    }
    router.Static("/uploads", "./uploads")

    port := cfg.ServerPort
    if port == "" {
        port = "8080"
    }

    log.Printf("Server is running on port %s", port)
    if err := router.Run(fmt.Sprintf(":%s", port)); err != nil {
        log.Fatalf("failed to run server: %v", err)
    }
}
