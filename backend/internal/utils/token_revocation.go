package utils

import (
    "time"

    "gorm.io/gorm"

    "github.com/SA/Golang-Backend-Example/internal/models"
)

// TokenRevoker records and checks individually-revoked JWTs (logout), keyed
// by the token's JTI claim. It's a thin wrapper around the revoked_tokens
// table rather than an in-memory blacklist so revocation survives a restart
// and works the same across multiple backend instances.
type TokenRevoker struct {
    db *gorm.DB
}

// NewTokenRevoker returns a revoker backed by db.
func NewTokenRevoker(db *gorm.DB) TokenRevoker {
    return TokenRevoker{db: db}
}

// Revoke marks a token as unusable for the remainder of its natural
// lifetime. key is whatever utils.TokenRevocationKey computed for it (the
// token's own JTI, or a hash fallback) — always non-empty, so every token
// can actually be revoked, not just ones with a JTI. expiresAt should be the
// token's own exp claim, so the row can later be pruned once it would have
// expired anyway.
func (r TokenRevoker) Revoke(key string, userID uint, expiresAt time.Time) error {
    row := models.RevokedToken{
        JTI:       key,
        UserID:    userID,
        ExpiresAt: expiresAt.UTC(),
        RevokedAt: time.Now().UTC(),
    }
    // Idempotent: logging out twice with the same token just re-marks it revoked.
    return r.db.Save(&row).Error
}

// IsRevoked reports whether key (see utils.TokenRevocationKey) has been revoked.
func (r TokenRevoker) IsRevoked(key string) bool {
    var count int64
    r.db.Model(&models.RevokedToken{}).Where("jti = ?", key).Count(&count)
    return count > 0
}

// PruneExpired deletes revoked-token rows whose underlying JWT has already
// expired naturally — they're no longer needed since an expired token is
// already rejected by signature/exp validation regardless of this table.
// Called once at startup (config/database.go) rather than run as a
// background job, which is enough at this project's scale.
func PruneExpiredRevokedTokens(db *gorm.DB) error {
    return db.Where("expires_at < ?", time.Now().UTC()).Delete(&models.RevokedToken{}).Error
}
