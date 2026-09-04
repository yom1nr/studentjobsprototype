package utils

import (
	"testing"
	"time"
)

func TestJWTProvider_RoundTrip(t *testing.T) {
	p := NewJWTProvider("test-secret", time.Hour)

	tok, err := p.GenerateToken(42, "employer")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	claims, err := p.ParseToken(tok)
	if err != nil {
		t.Fatalf("ParseToken: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("UserID = %d, want 42", claims.UserID)
	}
	if claims.Role != "employer" {
		t.Errorf("Role = %q, want employer", claims.Role)
	}
}

func TestJWTProvider_RejectsWrongSecret(t *testing.T) {
	issuer := NewJWTProvider("real-secret", time.Hour)
	tok, err := issuer.GenerateToken(1, "student")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	verifier := NewJWTProvider("different-secret", time.Hour)
	if _, err := verifier.ParseToken(tok); err == nil {
		t.Fatal("ParseToken accepted a token signed with a different secret")
	}
}

func TestJWTProvider_RejectsExpired(t *testing.T) {
	p := NewJWTProvider("test-secret", -time.Minute) // already expired on issue
	tok, err := p.GenerateToken(1, "student")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if _, err := p.ParseToken(tok); err == nil {
		t.Fatal("ParseToken accepted an expired token")
	}
}

func TestJWTProvider_RejectsGarbage(t *testing.T) {
	p := NewJWTProvider("test-secret", time.Hour)
	for _, bad := range []string{"", "not-a-jwt", "a.b.c", "Bearer x"} {
		if _, err := p.ParseToken(bad); err == nil {
			t.Errorf("ParseToken(%q) = nil error, want rejection", bad)
		}
	}
}

func TestJWTProvider_RejectsUnconfiguredSecret(t *testing.T) {
	var p JWTProvider // zero value: empty secret
	if _, err := p.ParseToken("anything"); err == nil {
		t.Fatal("ParseToken accepted a token with no configured secret")
	}
}
