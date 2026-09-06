package models

import "time"

// RevokedToken records a JWT that was invalidated before its natural
// expiry (logout). JTI is the token's unique id (claims.ID); ExpiresAt
// mirrors the token's own expiry so expired rows can be pruned instead of
// accumulating forever — once a token would have expired naturally anyway,
// there's no need to keep checking it against this table.
type RevokedToken struct {
	JTI       string    `gorm:"primaryKey;size:36" json:"jti"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	ExpiresAt time.Time `gorm:"index;not null" json:"expires_at"`
	RevokedAt time.Time `gorm:"not null" json:"revoked_at"`
}
