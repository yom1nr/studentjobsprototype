package utils

import (
    "errors"
    "os"
    "time"

    "github.com/golang-jwt/jwt/v5"
)

const ContextUserIDKey = "user_id"
const ContextUserRoleKey = "user_role"

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
// role-gated routes don't need a DB lookup per request.
func (p JWTProvider) GenerateToken(userID uint, role string) (string, error) {
    claims := JWTClaims{
        UserID: userID,
        Role:   role,
        RegisteredClaims: jwt.RegisteredClaims{
            IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
            ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(p.expiresIn)),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(p.secret))
}

// ParseToken validates a token string and returns its claims.
func ParseToken(tokenString string) (*JWTClaims, error) {
    secret := os.Getenv("JWT_SECRET")
    if secret == "" {
        return nil, errors.New("JWT_SECRET is not set")
    }

    claims := &JWTClaims{}
    parsed, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return []byte(secret), nil
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
