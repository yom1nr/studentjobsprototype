package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/SA/Golang-Backend-Example/internal/controllers"
	"github.com/SA/Golang-Backend-Example/internal/models"
	"github.com/SA/Golang-Backend-Example/internal/testsupport"
)

func mustCreateAdmin(t *testing.T, db *gorm.DB, email string) uint {
	t.Helper()
	user := models.User{UserName: email, Email: email, Password: "x", Role: "admin"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user %s: %v", email, err)
	}
	admin := models.Admin{UserID: user.UserID, FirstName: "Seed", LastName: "Admin"}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin %s: %v", email, err)
	}
	return user.UserID
}

func newAdminProfileRouter(db *gorm.DB, adminUserID uint) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := controllers.NewAdminController(db)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", adminUserID)
		c.Next()
	})
	r.GET("/api/v1/admin/profile", handler.GetMyProfile)
	r.PUT("/api/v1/admin/profile", handler.UpsertMyProfile)
	return r
}

// TestAdminController_Profile_GetAndUpdate covers the two endpoints added so
// an admin can manage their own profile (name/position/department/enterprise)
// from the settings page instead of only ever having it set once by the seeder.
func TestAdminController_Profile_GetAndUpdate(t *testing.T) {
	db := testsupport.SetupTestDB(t)
	adminUserID := mustCreateAdmin(t, db, "profile.admin@example.com")
	r := newAdminProfileRouter(db, adminUserID)

	// GET reflects what was seeded at creation time.
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/admin/profile", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET profile: HTTP %d, body=%s", rec.Code, rec.Body.String())
	}
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode envelope: %v", err)
	}
	var got struct {
		FirstName string `json:"first_name"`
		Email     string `json:"email"`
	}
	if err := json.Unmarshal(env.Data, &got); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if got.FirstName != "Seed" || got.Email != "profile.admin@example.com" {
		t.Errorf("GET profile = %+v, want FirstName=Seed Email=profile.admin@example.com", got)
	}

	// PUT updates the row, and the response reflects the new values immediately.
	body, _ := json.Marshal(map[string]string{
		"first_name": "สมชาย",
		"last_name":  "ใจดี",
		"position":   "เจ้าหน้าที่ทะเบียน",
		"department": "กองพัฒนานักศึกษา",
		"enterprise": "มหาวิทยาลัยเทคโนโลยีสุรนารี",
	})
	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT profile: HTTP %d, body=%s", rec.Code, rec.Body.String())
	}

	// A fresh GET (simulating a page reload) proves it actually persisted,
	// not just echoed back in the PUT response.
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/admin/profile", nil))
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode envelope after update: %v", err)
	}
	var afterUpdate struct {
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		Position   string `json:"position"`
		Department string `json:"department"`
		Enterprise string `json:"enterprise"`
	}
	if err := json.Unmarshal(env.Data, &afterUpdate); err != nil {
		t.Fatalf("decode profile after update: %v", err)
	}
	want := struct {
		FirstName  string `json:"first_name"`
		LastName   string `json:"last_name"`
		Position   string `json:"position"`
		Department string `json:"department"`
		Enterprise string `json:"enterprise"`
	}{"สมชาย", "ใจดี", "เจ้าหน้าที่ทะเบียน", "กองพัฒนานักศึกษา", "มหาวิทยาลัยเทคโนโลยีสุรนารี"}
	if afterUpdate != want {
		t.Errorf("profile after update = %+v, want %+v", afterUpdate, want)
	}
}

// TestAdminController_Profile_RequiresName confirms the required-field
// validation (matches models.Admin's not-null FirstName/LastName) is enforced
// at the API layer, not just the database.
func TestAdminController_Profile_RequiresName(t *testing.T) {
	db := testsupport.SetupTestDB(t)
	adminUserID := mustCreateAdmin(t, db, "novalidate.admin@example.com")
	r := newAdminProfileRouter(db, adminUserID)

	body, _ := json.Marshal(map[string]string{"first_name": "", "last_name": ""})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT profile with blank names: HTTP %d, want 400, body=%s", rec.Code, rec.Body.String())
	}
}
