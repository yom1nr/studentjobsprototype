package routes

import (
    "github.com/gin-gonic/gin"

    "github.com/SA/Golang-Backend-Example/internal/controllers"
    "github.com/SA/Golang-Backend-Example/internal/middleware"
)

// SetupRouter registers application routes and middleware.
func SetupRouter(
    authHandler *controllers.AuthController,
    userHandler *controllers.UserController,
    employerHandler *controllers.EmployerController,
    adminHandler *controllers.AdminController,
    notificationHandler *controllers.NotificationController,
    jobpostHandler *controllers.JobpostController,
    studentHandler *controllers.StudentController,
    applicationHandler *controllers.ApplicationController,
    interviewHandler *controllers.InterviewController,
    employmentHandler *controllers.EmploymentController,
    timeRecordHandler *controllers.TimeRecordController,
    payrollHandler *controllers.PayrollController,
    complaintHandler *controllers.ComplaintController,
) *gin.Engine {
    router := gin.New()
    router.Use(gin.Logger())
    router.Use(middleware.CORSMiddleware())

    // Public Routes
    api := router.Group("/api/v1")
    auth := api.Group("/auth")
    auth.POST("/register", authHandler.Register)
    auth.POST("/login", authHandler.Login)

    // Private Routes
    users := api.Group("/users")
    users.Use(middleware.JWTAuthMiddleware())
    users.GET("/profile", userHandler.GetProfile)
    users.PUT("/profile", userHandler.UpdateProfile)
    users.DELETE("/profile", userHandler.DeleteUser)
    users.GET("", userHandler.GetAllUsers)
    users.GET("/:id", userHandler.GetUserByID)

    // Employer's own company profile (submits/edits, triggers admin review)
    employer := api.Group("/employer")
    employer.Use(middleware.JWTAuthMiddleware(), middleware.RequireRole("employer"))
    employer.GET("/profile", employerHandler.GetMyProfile)
    employer.PUT("/profile", employerHandler.UpsertMyProfile)
    employer.GET("/jobposts", jobpostHandler.ListMyJobposts)
    employer.POST("/jobposts", jobpostHandler.CreateJobpost)
    employer.PUT("/jobposts/:id", jobpostHandler.UpdateJobpost)
    employer.POST("/jobposts/:id/close", jobpostHandler.CloseJobpost)

    // Job posts — browsing (any authenticated role)
    jobposts := api.Group("/jobposts")
    jobposts.Use(middleware.JWTAuthMiddleware())
    jobposts.GET("", jobpostHandler.ListOpenJobposts)
    jobposts.GET("/:id", jobpostHandler.GetJobpostDetail)

    // Student's own profile
    student := api.Group("/student")
    student.Use(middleware.JWTAuthMiddleware(), middleware.RequireRole("student"))
    student.GET("/profile", studentHandler.GetMyProfile)
    student.PUT("/profile", studentHandler.UpsertMyProfile)
    student.GET("/applications", applicationHandler.ListMyApplications)
    student.POST("/applications", applicationHandler.CreateApplication)

    // Employer reviewing applications to their own job posts
    employer.GET("/applications", applicationHandler.ListEmployerApplications)
    employer.GET("/applications/:id", applicationHandler.GetEmployerApplicationDetail)
    employer.POST("/applications/:id/review", applicationHandler.ReviewApplication)

    // Employer: interview scheduling (B6733827 subsystem 1)
    employer.POST("/interviews", interviewHandler.CreateInterview)
    employer.PUT("/interviews/:id", interviewHandler.UpdateInterview)
    employer.POST("/interviews/:id/result", interviewHandler.SendResult)

    // Employer: employment agreements (B6733827 subsystem 2)
    employer.POST("/agreements", employmentHandler.CreateAgreement)

    // Student: confirm interview attendance / respond to reschedule requests
    student.POST("/interviews/:id/confirm", interviewHandler.ConfirmAttendance)

    // Student: respond to an employment agreement
    student.POST("/agreements/:id/accept", employmentHandler.Accept)
    student.POST("/agreements/:id/reject", employmentHandler.Reject)

    // Interviews / agreements — shared reads and reschedule requests (any authenticated role)
    interviews := api.Group("/interviews")
    interviews.Use(middleware.JWTAuthMiddleware())
    interviews.GET("", interviewHandler.ListMine)
    interviews.POST("/:id/reschedule", interviewHandler.RequestReschedule)
    interviews.GET("/:id/reschedules", interviewHandler.ListReschedules)

    agreements := api.Group("/agreements")
    agreements.Use(middleware.JWTAuthMiddleware())
    agreements.GET("", employmentHandler.ListMine)

    // Student: time tracking (B6729875 subsystem 1)
    student.POST("/time-records/check-in", timeRecordHandler.CheckIn)
    student.POST("/time-records/:id/check-out", timeRecordHandler.CheckOut)
    student.GET("/time-records", timeRecordHandler.ListMyTimeRecords)
    student.POST("/time-records/:id/edit-request", timeRecordHandler.CreateEditRequest)

    // Employer: time-edit approval queue
    employer.GET("/time-records", timeRecordHandler.ListEmployerTimeRecords)
    employer.GET("/time-edit-requests", timeRecordHandler.ListEmployerEditRequests)
    employer.POST("/time-edit-requests/:id/approve", timeRecordHandler.ApproveEditRequest)
    employer.POST("/time-edit-requests/:id/reject", timeRecordHandler.RejectEditRequest)

    // Employer: payroll calculation + payment (B6729875 subsystem 2)
    employer.POST("/payrolls", payrollHandler.CreatePayroll)
    employer.POST("/payrolls/:id/approve", payrollHandler.ApprovePayroll)

    // Student: confirm payment receipt
    student.POST("/payrolls/:id/confirm", payrollHandler.ConfirmReceipt)

    // Payroll — shared read (any authenticated role)
    payrolls := api.Group("/payrolls")
    payrolls.Use(middleware.JWTAuthMiddleware())
    payrolls.GET("", payrollHandler.ListMine)

    // Complaints (B6716493 subsystem 1) — submit/read own (any authenticated role)
    complaints := api.Group("/complaints")
    complaints.Use(middleware.JWTAuthMiddleware())
    complaints.POST("", complaintHandler.Create)
    complaints.GET("", complaintHandler.ListMine)
    complaints.GET("/:id", complaintHandler.GetDetail)
    complaints.POST("/:id/attachments", complaintHandler.AddAttachment)

    // Admin: employer verification workflow
    admin := api.Group("/admin")
    admin.Use(middleware.JWTAuthMiddleware(), middleware.RequireRole("admin"))
    admin.GET("/employers", adminHandler.ListEmployerApprovals)
    admin.GET("/employers/:id", adminHandler.GetEmployerDetail)
    admin.POST("/employers/:id/approve", adminHandler.ApproveEmployer)
    admin.POST("/employers/:id/reject", adminHandler.RejectEmployer)
    admin.GET("/complaints", complaintHandler.ListAll)
    admin.POST("/complaints/:id/history", complaintHandler.AddHistory)

    // Notifications (any authenticated role)
    notifications := api.Group("/notifications")
    notifications.Use(middleware.JWTAuthMiddleware())
    notifications.GET("", notificationHandler.ListMine)
    notifications.GET("/unread-count", notificationHandler.UnreadCount)
    notifications.PUT("/:id/read", notificationHandler.MarkRead)
    notifications.PUT("/read-all", notificationHandler.MarkAllRead)

    return router
}
