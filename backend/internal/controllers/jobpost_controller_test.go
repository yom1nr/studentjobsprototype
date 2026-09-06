package controllers_test

import (
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

func mustCreateEmployer(t *testing.T, db *gorm.DB, email, companyName string) uint {
	t.Helper()
	user := models.User{UserName: email, Email: email, Password: "x", Role: "employer"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user %s: %v", email, err)
	}
	employer := models.Employer{
		UserID:      user.UserID,
		FirstName:   "Test",
		LastName:    "Employer",
		CompanyName: companyName,
		TaxID:       email, // unique, doesn't need to look like a real tax id for this test
	}
	if err := db.Create(&employer).Error; err != nil {
		t.Fatalf("create employer %s: %v", email, err)
	}
	return user.UserID
}

func mustCreateOpenJobpost(t *testing.T, db *gorm.DB, employerID uint, jobID, position string) {
	t.Helper()
	jp := models.Jobpost{
		UserID:   employerID,
		JobID:    jobID,
		Position: position,
		Status:   "open",
	}
	if err := db.Create(&jp).Error; err != nil {
		t.Fatalf("create jobpost %s: %v", jobID, err)
	}
}

// TestJobpostController_ListOpenJobposts_ResolvesCompanyNamesAcrossEmployers
// is a regression test for the N+1 fix in mapWithCompanyName's list path:
// postings from several different employers, plus more than one posting
// from the same employer, must each come back with the correct company
// name rather than an empty string or another employer's name.
func TestJobpostController_ListOpenJobposts_ResolvesCompanyNamesAcrossEmployers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testsupport.SetupTestDB(t)

	empA := mustCreateEmployer(t, db, "employer.a@example.com", "Alpha Co")
	empB := mustCreateEmployer(t, db, "employer.b@example.com", "Beta Co")

	mustCreateOpenJobpost(t, db, empA, "JOB-A1", "Barista")
	mustCreateOpenJobpost(t, db, empA, "JOB-A2", "Cashier")
	mustCreateOpenJobpost(t, db, empB, "JOB-B1", "Tutor")

	handler := controllers.NewJobpostController(db)
	r := gin.New()
	r.GET("/api/v1/jobposts", handler.ListOpenJobposts)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/jobposts", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("ListOpenJobposts: HTTP %d, body=%s", rec.Code, rec.Body.String())
	}

	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response envelope: %v", err)
	}
	var jobposts []struct {
		EmployerID  uint   `json:"employer_id"`
		CompanyName string `json:"company_name"`
		Position    string `json:"position"`
	}
	if err := json.Unmarshal(env.Data, &jobposts); err != nil {
		t.Fatalf("decode jobposts: %v", err)
	}

	got := map[string]string{} // position -> company name
	for _, jp := range jobposts {
		got[jp.Position] = jp.CompanyName
	}

	want := map[string]string{
		"Barista": "Alpha Co",
		"Cashier": "Alpha Co",
		"Tutor":   "Beta Co",
	}
	for position, wantCompany := range want {
		gotCompany, ok := got[position]
		if !ok {
			t.Errorf("position %q missing from response", position)
			continue
		}
		if gotCompany != wantCompany {
			t.Errorf("position %q: company_name = %q, want %q", position, gotCompany, wantCompany)
		}
	}
}
