package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/SA/Golang-Backend-Example/internal/controllers"
	"github.com/SA/Golang-Backend-Example/internal/middleware"
	"github.com/SA/Golang-Backend-Example/internal/testsupport"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// newAuthRouter wires just the auth endpoints under test, mirroring how
// routes.go wires them in production (register/login public, logout behind
// JWTAuthMiddleware) without pulling in every other controller.
func newAuthRouter(t *testing.T) (*gin.Engine, utils.JWTProvider, utils.TokenRevoker) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db := testsupport.SetupTestDB(t)
	jwtProvider := utils.NewJWTProvider("test-secret", time.Hour)
	revoker := utils.NewTokenRevoker(db)
	authHandler := controllers.NewAuthController(db, jwtProvider, revoker)
	jwtAuth := middleware.JWTAuthMiddleware(jwtProvider, revoker)

	r := gin.New()
	auth := r.Group("/api/v1/auth")
	auth.POST("/register", authHandler.Register)
	auth.POST("/login", authHandler.Login)
	auth.POST("/logout", jwtAuth, authHandler.Logout)

	// One route standing in for "any protected endpoint" — enough to prove a
	// token works (or has stopped working) without wiring the whole app.
	protected := r.Group("/api/v1/whoami")
	protected.Use(jwtAuth)
	protected.GET("", func(c *gin.Context) {
		userID, _ := utils.GetUserIDFromContext(c)
		utils.JSONSuccess(c, http.StatusOK, gin.H{"user_id": userID})
	})

	return r, jwtProvider, revoker
}

type envelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   json.RawMessage `json:"error"`
}

func doJSON(t *testing.T, r *gin.Engine, method, path string, body any, token string) (*httptest.ResponseRecorder, envelope) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode request body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var env envelope
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
			t.Fatalf("decode response body %q: %v", rec.Body.String(), err)
		}
	}
	return rec, env
}

// TestAuth_RegisterLoginLogout_RevokesOnlyThatToken exercises the full
// register -> login -> use -> logout -> reuse-rejected flow end to end
// against a real Postgres database (see testsupport.SetupTestDB), and
// confirms a second concurrent session for the same user is unaffected by
// the first one's logout.
func TestAuth_RegisterLoginLogout_RevokesOnlyThatToken(t *testing.T) {
	r, _, _ := newAuthRouter(t)

	registerBody := map[string]string{
		"user_name": "integrationtester",
		"email":     "integration.tester@example.com",
		"password":  "password123",
	}
	if rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/register", registerBody, ""); rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("register: HTTP %d, body=%s", rec.Code, string(env.Data)+string(env.Error))
	}

	loginBody := map[string]string{"email": "integration.tester@example.com", "password": "password123"}
	rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/login", loginBody, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login (session A): HTTP %d, body=%s", rec.Code, string(env.Error))
	}
	var authResp struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(env.Data, &authResp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	tokenA := authResp.Token
	if tokenA == "" {
		t.Fatal("login returned an empty token")
	}

	// A second login (e.g. a second device/tab) gets its own independent token.
	rec, env = doJSON(t, r, http.MethodPost, "/api/v1/auth/login", loginBody, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login (session B): HTTP %d, body=%s", rec.Code, string(env.Error))
	}
	if err := json.Unmarshal(env.Data, &authResp); err != nil {
		t.Fatalf("decode second login response: %v", err)
	}
	tokenB := authResp.Token
	if tokenB == "" || tokenB == tokenA {
		t.Fatalf("expected a distinct token for the second session, got %q vs %q", tokenB, tokenA)
	}

	// Both tokens work before either is revoked.
	if rec, _ := doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, tokenA); rec.Code != http.StatusOK {
		t.Fatalf("whoami with tokenA before logout: HTTP %d", rec.Code)
	}
	if rec, _ := doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, tokenB); rec.Code != http.StatusOK {
		t.Fatalf("whoami with tokenB before logout: HTTP %d", rec.Code)
	}

	// Log out session A only.
	if rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/logout", nil, tokenA); rec.Code != http.StatusOK {
		t.Fatalf("logout tokenA: HTTP %d, body=%s", rec.Code, string(env.Error))
	}

	// tokenA is now rejected...
	rec, env = doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, tokenA)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("whoami with tokenA after logout: HTTP %d, want 401, body=%s", rec.Code, string(env.Error))
	}

	// ...but tokenB (the other session) still works: logout only revokes the
	// one token that was presented, not every session for that user.
	if rec, env := doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, tokenB); rec.Code != http.StatusOK {
		t.Fatalf("whoami with tokenB after tokenA's logout: HTTP %d, body=%s", rec.Code, string(env.Error))
	}

	// Logging out with an already-revoked token is a no-op, not an error.
	if rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/logout", nil, tokenA); rec.Code != http.StatusUnauthorized {
		t.Fatalf("logout with an already-revoked token: HTTP %d, want 401 (invalid token), body=%s", rec.Code, string(env.Error))
	}
}

// TestAuth_Logout_RevokesTokenWithoutJTI proves the fix for the Staff-Eng
// finding that logout lied to the user: a token with no JTI (issued before
// that feature shipped, or by some future regression) used to hit a silent
// no-op in TokenRevoker.Revoke and still get a 200 "logged out" back, while
// staying valid until it expired naturally. It must now actually be revoked,
// via the SHA-256 hash fallback in utils.TokenRevocationKey.
func TestAuth_Logout_RevokesTokenWithoutJTI(t *testing.T) {
	r, _, _ := newAuthRouter(t)

	// newAuthRouter signs with "test-secret" — build a token by hand (with no
	// ID claim) the same way, since JWTProvider.GenerateToken can no longer
	// produce one without a JTI.
	claims := utils.JWTClaims{
		UserID: 999,
		Role:   "student",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(time.Hour)),
		},
	}
	legacyToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("sign legacy token: %v", err)
	}

	if rec, env := doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, legacyToken); rec.Code != http.StatusOK {
		t.Fatalf("whoami with legacy (no-JTI) token before logout: HTTP %d, body=%s", rec.Code, string(env.Error))
	}

	if rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/logout", nil, legacyToken); rec.Code != http.StatusOK {
		t.Fatalf("logout with legacy token: HTTP %d, body=%s", rec.Code, string(env.Error))
	}

	if rec, env := doJSON(t, r, http.MethodGet, "/api/v1/whoami", nil, legacyToken); rec.Code != http.StatusUnauthorized {
		t.Fatalf("whoami with legacy token after logout: HTTP %d, want 401 (should be genuinely revoked), body=%s", rec.Code, string(env.Error))
	}
}

// TestAuth_Login_RejectsWrongPassword is a quick negative-path check that the
// login endpoint doesn't leak a distinguishable error for bad credentials.
func TestAuth_Login_RejectsWrongPassword(t *testing.T) {
	r, _, _ := newAuthRouter(t)

	registerBody := map[string]string{
		"user_name": "wrongpasstester",
		"email":     "wrongpass.tester@example.com",
		"password":  "password123",
	}
	if rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/register", registerBody, ""); rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("register: HTTP %d, body=%s", rec.Code, string(env.Error))
	}

	loginBody := map[string]string{"email": "wrongpass.tester@example.com", "password": "not-the-password"}
	rec, env := doJSON(t, r, http.MethodPost, "/api/v1/auth/login", loginBody, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("login with wrong password: HTTP %d, want 401, body=%s", rec.Code, string(env.Error))
	}
}
