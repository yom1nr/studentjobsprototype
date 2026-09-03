package utils

import "time"

// CalcAge returns the number of full years between dob and now. Used wherever a
// student's age is displayed — it is always derived from the stored date of
// birth, never entered directly.
func CalcAge(dob time.Time) int {
	now := time.Now()
	years := now.Year() - dob.Year()
	// Not had this year's birthday yet? subtract one.
	if now.Month() < dob.Month() || (now.Month() == dob.Month() && now.Day() < dob.Day()) {
		years--
	}
	if years < 0 {
		return 0
	}
	return years
}
