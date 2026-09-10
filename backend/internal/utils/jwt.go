package utils

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

const ContextUserIDKey = "user_id"
const ContextUserRoleKey = "user_role"
const ContextTokenJTIKey = "token_jti"
const ContextTokenExpKey = "token_exp"

// JWTProvider signs and validates JWT tokens.
type JWTProvider struct {
    secret    string
    expiresIn time.Duration
}

// JWTClaims stores token claims for authenticated users.
type JWTClaims struct {
    UserID uint   `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

// NewJWTProvider returns a configured JWT provider.
func NewJWTProvider(secret string, expiresIn time.Duration) JWTProvider {
    return JWTProvider{secret: secret, expiresIn: expiresIn}
}

// GenerateToken creates a signed JWT token for a user, embedding their role so
// role-gated routes don't need a DB lookup per request. Each token gets a
// random JTI (claims.ID) so a single token can be individually revoked
// (logout) without invalidating the user's other sessions/devices.
func (p JWTProvider) GenerateToken(userID uint, role string) (string, error) {
    jti, err := newJTI()
    if err != nil {
        return "", err
    }

    claims := JWTClaims{
        UserID: userID,
        Role:   role,
        RegisteredClaims: jwt.RegisteredClaims{
            ID:        jti,
            IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
            ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(p.expiresIn)),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(p.secret))
}

// newJTI returns a random 32-hex-char token id. crypto/rand is used (not a
// UUID library) to avoid pulling in a new dependency for something this small.
func newJTI() (string, error) {
    buf := make([]byte, 16)
    if _, err := rand.Read(buf); err != nil {
        return "", err
    }
    return hex.EncodeToString(buf), nil
}

// TokenRevocationKey returns the identifier a token is revoked/checked under.
// Normally that's the token's own JTI (claims.ID). If it's ever empty — a
// token issued before JTIs existed, or a future bug that reintroduces that —
// a SHA-256 hash of the raw token string is used instead, so logout always
// has *something* unique to blocklist and can never silently no-op.
func TokenRevocationKey(claims *JWTClaims, rawToken string) string {
    if claims.ID != "" {
        return claims.ID
    }
    sum := sha256.Sum256([]byte(rawToken))
    return "legacy:" + hex.EncodeToString(sum[:])
}

// ParseToken validates a token string against this provider's secret and
// returns its claims. Uses the same secret GenerateToken signs with, rather
// than re-reading the environment, so signing and verification can't drift.
func (p JWTProvider) ParseToken(tokenString string) (*JWTClaims, error) {
    if p.secret == "" {
        return nil, errors.New("jwt secret is not configured")
    }

    claims := &JWTClaims{}
    parsed, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return []byte(p.secret), nil
    })
    if err != nil {
        return nil, err
    }

    if !parsed.Valid {
        return nil, errors.New("invalid token")
    }
    return claims, nil
}

// GetUserIDFromContext reads the authenticated user ID from Gin context.
// Accepts the broader `Get(any) (any, bool)` signature used by recent Gin versions.
func GetUserIDFromContext(c interface{ Get(any) (any, bool) }) (uint, bool) {
    raw, ok := c.Get(ContextUserIDKey)
    if !ok {
        return 0, false
    }

    userID, ok := raw.(uint)
    return userID, ok
}

// GetUserRoleFromContext reads the authenticated user's role from Gin context.
func GetUserRoleFromContext(c interface{ Get(any) (any, bool) }) (string, bool) {
    raw, ok := c.Get(ContextUserRoleKey)
    if !ok {
        return "", false
    }

    role, ok := raw.(string)
    return role, ok
}

// GetTokenClaimsFromContext reads the current request's token JTI and
// expiry, as set by JWTAuthMiddleware. Used by logout to revoke exactly the
// token that was presented, without re-parsing the Authorization header.
func GetTokenClaimsFromContext(c interface{ Get(any) (any, bool) }) (jti string, expiresAt time.Time, ok bool) {
    rawJTI, ok1 := c.Get(ContextTokenJTIKey)
    rawExp, ok2 := c.Get(ContextTokenExpKey)
    if !ok1 || !ok2 {
        return "", time.Time{}, false
    }
    jti, ok1 = rawJTI.(string)
    exp, ok2 := rawExp.(*jwt.NumericDate)
    if !ok1 || !ok2 || exp == nil {
        return "", time.Time{}, false
    }
    return jti, exp.Time, true
}
