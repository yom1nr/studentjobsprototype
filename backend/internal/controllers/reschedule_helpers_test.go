package controllers

import (
	"testing"
	"time"

	"github.com/SA/Golang-Backend-Example/internal/models"
)

func TestUTCInstant(t *testing.T) {
	tests := []struct {
		name string
		in   string
		ok   bool
		want string // formatted RFC3339 when ok
	}{
		{"Z offset", "2026-09-20T13:30:00Z", true, "2026-09-20T13:30:00Z"},
		{"+00:00 offset", "2026-09-20T13:30:00+00:00", true, "2026-09-20T13:30:00Z"},
		{"positive offset rejected", "2026-09-20T13:30:00+07:00", false, ""},
		{"negative offset rejected", "2026-09-20T13:30:00-05:00", false, ""},
		{"garbage rejected", "not-a-time", false, ""},
		{"empty rejected", "", false, ""},
		{"date only rejected", "2026-09-20", false, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := utcInstant(tc.in)
			if ok != tc.ok {
				t.Fatalf("utcInstant(%q) ok = %v, want %v", tc.in, ok, tc.ok)
			}
			if ok {
				if got.Location() != time.UTC {
					t.Errorf("result location = %v, want UTC", got.Location())
				}
				if got.Format(time.RFC3339) != tc.want {
					t.Errorf("result = %s, want %s", got.Format(time.RFC3339), tc.want)
				}
			}
		})
	}
}

func TestAgreementEndText(t *testing.T) {
	start := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)

	if got := agreementEndText(nil); got != "" {
		t.Errorf("nil agreement: got %q, want empty", got)
	}
	if got := agreementEndText(&models.EmploymentAgreement{DurationMonths: 3}); got != "" {
		t.Errorf("no start date: got %q, want empty", got)
	}
	if got := agreementEndText(&models.EmploymentAgreement{StartDate: &start}); got != "" {
		t.Errorf("no duration: got %q, want empty", got)
	}
	got := agreementEndText(&models.EmploymentAgreement{StartDate: &start, DurationMonths: 3})
	if got != "2026-04-15" {
		t.Errorf("3 months from 2026-01-15: got %q, want 2026-04-15", got)
	}
}
