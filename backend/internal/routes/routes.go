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

    // Admin: employer verification workflow
    admin := api.Group("/admin")
    admin.Use(middleware.JWTAuthMiddleware(), middleware.RequireRole("admin"))
    admin.GET("/employers", adminHandler.ListEmployerApprovals)
    admin.GET("/employers/:id", adminHandler.GetEmployerDetail)
    admin.POST("/employers/:id/approve", adminHandler.ApproveEmployer)
    admin.POST("/employers/:id/reject", adminHandler.RejectEmployer)

    // Notifications (any authenticated role)
    notifications := api.Group("/notifications")
    notifications.Use(middleware.JWTAuthMiddleware())
    notifications.GET("", notificationHandler.ListMine)
    notifications.GET("/unread-count", notificationHandler.UnreadCount)
    notifications.PUT("/:id/read", notificationHandler.MarkRead)
    notifications.PUT("/read-all", notificationHandler.MarkAllRead)

    return router
}
