package utils

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// ValidatePasswordStrength enforces the account password policy: at least 8
// characters with a mix of letters and digits. Returns a user-facing (Thai)
// message when the policy is not met.
func ValidatePasswordStrength(pw string) error {
	if len(pw) < 8 {
		return errors.New("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
	}
	var hasLetter, hasDigit bool
	for _, r := range pw {
		switch {
		case r >= '0' && r <= '9':
			hasDigit = true
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'):
			hasLetter = true
		}
	}
	if !hasLetter || !hasDigit {
		return errors.New("รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข")
	}
	return nil
}

// HashPassword returns a bcrypt-hashed version of the plain password.
func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

// ComparePassword compares a bcrypt hashed password with a plaintext password.
func ComparePassword(hashedPassword, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}
