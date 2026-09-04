package routes

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/controllers"
	"github.com/SA/Golang-Backend-Example/internal/middleware"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// SetupRouter registers application routes and middleware.
func SetupRouter(
	db *gorm.DB,
	jwtProvider utils.JWTProvider,
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
	uploadHandler *controllers.UploadController,
) *gin.Engine {
	router := gin.New()
	// Recovery must be registered here (before any routes) so it actually wraps
	// the handler chain — adding it after SetupRouter returns is a no-op.
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(middleware.CORSMiddleware())

	// One JWT middleware instance, verifying against the provider that issues
	// tokens (not a re-read of the environment).
	jwtAuth := middleware.JWTAuthMiddleware(jwtProvider)

	// Public Routes
	api := router.Group("/api/v1")
	auth := api.Group("/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)

	// File upload — any authenticated user (profile images, employer docs, evidence)
	api.POST("/upload", jwtAuth, uploadHandler.UploadFile)

	// Private Routes
	users := api.Group("/users")
	users.Use(jwtAuth)
	users.GET("/profile", userHandler.GetProfile)
	users.PUT("/profile", userHandler.UpdateProfile)
	users.DELETE("/profile", userHandler.DeleteUser)
	// Enumerating / reading arbitrary user accounts is an admin-only capability.
	users.GET("", middleware.RequireRole("admin"), userHandler.GetAllUsers)
	users.GET("/:id", middleware.RequireRole("admin"), userHandler.GetUserByID)

	// Employer's own company profile (submits/edits, triggers admin review)
	// Gates employer *action* routes (not profile / read-only) on admin approval.
	approvedEmployer := middleware.RequireApprovedEmployer(db)

	employer := api.Group("/employer")
	employer.Use(jwtAuth, middleware.RequireRole("employer"))
	employer.GET("/profile", employerHandler.GetMyProfile)
	employer.PUT("/profile", employerHandler.UpsertMyProfile)
	employer.POST("/documents/acknowledge", employerHandler.AcknowledgeRequestNote)
	employer.GET("/jobposts", jobpostHandler.ListMyJobposts)
	employer.POST("/jobposts", approvedEmployer, jobpostHandler.CreateJobpost)
	employer.PUT("/jobposts/:id", approvedEmployer, jobpostHandler.UpdateJobpost)
	employer.POST("/jobposts/:id/close", approvedEmployer, jobpostHandler.CloseJobpost)
	employer.DELETE("/jobposts/:id", approvedEmployer, jobpostHandler.DeleteJobpost)

	// Job posts — public browsing (no login required; only applying needs an account)
	jobposts := api.Group("/jobposts")
	jobposts.GET("", jobpostHandler.ListOpenJobposts)
	jobposts.GET("/:id", jobpostHandler.GetJobpostDetail)

	// Student's own profile
	student := api.Group("/student")
	student.Use(jwtAuth, middleware.RequireRole("student"))
	student.GET("/profile", studentHandler.GetMyProfile)
	student.PUT("/profile", studentHandler.UpsertMyProfile)
	student.POST("/schedule/extract", studentHandler.ExtractScheduleFromImage)
	student.GET("/applications", applicationHandler.ListMyApplications)
	student.POST("/applications", applicationHandler.CreateApplication)
	student.PUT("/applications/:id", applicationHandler.UpdateMyApplication)

	// Employer reviewing applications to their own job posts
	employer.GET("/applications", applicationHandler.ListEmployerApplications)
	employer.GET("/applications/:id", applicationHandler.GetEmployerApplicationDetail)
	employer.POST("/applications/:id/review", approvedEmployer, applicationHandler.ReviewApplication)
	employer.DELETE("/applications/:id", approvedEmployer, applicationHandler.DeleteApplication)

	// Employer: interview scheduling (B6733827 subsystem 1)
	employer.POST("/interviews", approvedEmployer, interviewHandler.CreateInterview)
	employer.PUT("/interviews/:id", approvedEmployer, interviewHandler.UpdateInterview)
	employer.POST("/interviews/:id/result", approvedEmployer, interviewHandler.SendResult)
	// Employer answers a student's request to move the appointment. Same
	// approved-employer gate as the rest of the hiring flow.
	employer.POST("/reschedules/:id/approve", approvedEmployer, interviewHandler.ApproveReschedule)
	employer.POST("/reschedules/:id/reject", approvedEmployer, interviewHandler.RejectReschedule)
	// Employer offers several times for the student to choose from — the other
	// half of the reschedule flow, split from the student's single-time request
	// below because the two don't share a shape (one time vs. up to five, no
	// approval step after the student picks).
	employer.POST("/interviews/:id/reschedule-offer", approvedEmployer, interviewHandler.OfferRescheduleSlots)

	// Employer: employment agreements (B6733827 subsystem 2)
	employer.POST("/agreements", approvedEmployer, employmentHandler.CreateAgreement)
	employer.DELETE("/agreements/:id", approvedEmployer, employmentHandler.DeleteAgreement)

	// Student: confirm interview attendance / respond to reschedule requests
	student.POST("/interviews/:id/confirm", interviewHandler.ConfirmAttendance)
	// Student asks to move the appointment to a single time; the employer then
	// approves or rejects it (POST /employer/reschedules/:id/approve|reject above).
	student.POST("/interviews/:id/reschedule", interviewHandler.RequestReschedule)
	// Student picks one of the times the employer offered.
	student.POST("/reschedules/:id/select", interviewHandler.SelectRescheduleSlot)

	// Student: respond to an employment agreement
	student.POST("/agreements/:id/accept", employmentHandler.Accept)
	student.POST("/agreements/:id/reject", employmentHandler.Reject)

	// Interviews / agreements — shared reads and reschedule requests (any authenticated role)
	interviews := api.Group("/interviews")
	interviews.Use(jwtAuth)
	interviews.GET("", interviewHandler.ListMine)
	interviews.GET("/:id/reschedules", interviewHandler.ListReschedules)

	agreements := api.Group("/agreements")
	agreements.Use(jwtAuth)
	agreements.GET("", employmentHandler.ListMine)

	// Student: time tracking (B6729875 subsystem 1)
	student.POST("/time-records/check-in", timeRecordHandler.CheckIn)
	student.POST("/time-records/:id/check-out", timeRecordHandler.CheckOut)
	student.GET("/time-records", timeRecordHandler.ListMyTimeRecords)
	student.POST("/time-records/:id/edit-request", timeRecordHandler.CreateEditRequest)

	// Employer: time-edit approval queue
	employer.GET("/time-records", timeRecordHandler.ListEmployerTimeRecords)
	employer.GET("/time-edit-requests", timeRecordHandler.ListEmployerEditRequests)
	employer.POST("/time-edit-requests/:id/approve", approvedEmployer, timeRecordHandler.ApproveEditRequest)
	employer.POST("/time-edit-requests/:id/reject", approvedEmployer, timeRecordHandler.RejectEditRequest)

	// Employer: payroll calculation + payment (B6729875 subsystem 2)
	employer.POST("/payrolls", approvedEmployer, payrollHandler.CreatePayroll)
	employer.POST("/payrolls/:id/approve", approvedEmployer, payrollHandler.ApprovePayroll)
	employer.GET("/payrolls/summary", payrollHandler.MonthlySummary)

	// Student: confirm payment receipt
	student.POST("/payrolls/:id/confirm", payrollHandler.ConfirmReceipt)

	// Payroll — shared read (any authenticated role)
	payrolls := api.Group("/payrolls")
	payrolls.Use(jwtAuth)
	payrolls.GET("", payrollHandler.ListMine)

	// Complaints (B6716493 subsystem 1) — submit/read own (any authenticated role)
	complaints := api.Group("/complaints")
	complaints.Use(jwtAuth)
	complaints.POST("", complaintHandler.Create)
	complaints.GET("", complaintHandler.ListMine)
	complaints.GET("/:id", complaintHandler.GetDetail)
	complaints.POST("/:id/attachments", complaintHandler.AddAttachment)

	// Admin: employer verification workflow
	admin := api.Group("/admin")
	admin.Use(jwtAuth, middleware.RequireRole("admin"))
	admin.GET("/employers", adminHandler.ListEmployerApprovals)
	admin.GET("/employers/:id", adminHandler.GetEmployerDetail)
	admin.POST("/employers/:id/approve", adminHandler.ApproveEmployer)
	admin.POST("/employers/:id/reject", adminHandler.RejectEmployer)
	admin.POST("/employers/:id/request-document", adminHandler.RequestDocuments)
	// Employer / student directory (browse + edit any account) and the audit trail
	admin.GET("/employer-directory", adminHandler.ListAllEmployers)
	admin.PUT("/employer-directory/:id", adminHandler.UpdateEmployer)
	admin.GET("/student-directory", adminHandler.ListAllStudents)
	admin.PUT("/student-directory/:id", adminHandler.UpdateStudent)
	admin.GET("/audit-logs", adminHandler.ListAuditLogs)
	admin.GET("/complaints", complaintHandler.ListAll)
	admin.POST("/complaints/:id/history", complaintHandler.AddHistory)

	// Admin: final pass/fail verification on employer-accepted applications
	admin.GET("/applications", applicationHandler.ListAdminApplications)
	admin.GET("/applications/:id", applicationHandler.GetAdminApplicationDetail)
	admin.POST("/applications/:id/verify", applicationHandler.VerifyApplication)

	// Notifications (any authenticated role)
	notifications := api.Group("/notifications")
	notifications.Use(jwtAuth)
	notifications.GET("", notificationHandler.ListMine)
	notifications.GET("/unread-count", notificationHandler.UnreadCount)
	notifications.PUT("/:id/read", notificationHandler.MarkRead)
	notifications.PUT("/read-all", notificationHandler.MarkAllRead)

	return router
}
