package middleware

import (
    "net/http"
    "os"
    "strings"

    "github.com/gin-gonic/gin"
)

// allowedOrigins reads the CORS allowlist from CORS_ALLOWED_ORIGINS
// (comma-separated). Defaults to the local Vite dev server ports.
func allowedOrigins() map[string]struct{} {
    raw := os.Getenv("CORS_ALLOWED_ORIGINS")
    if raw == "" {
        raw = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173"
    }
    set := make(map[string]struct{})
    for _, o := range strings.Split(raw, ",") {
        if o = strings.TrimSpace(o); o != "" {
            set[o] = struct{}{}
        }
    }
    return set
}

// CORSMiddleware echoes the request Origin only when it is in the allowlist.
// A wildcard "*" origin combined with Allow-Credentials is invalid and is
// never sent.
func CORSMiddleware() gin.HandlerFunc {
    origins := allowedOrigins()

    return func(c *gin.Context) {
        origin := c.GetHeader("Origin")
        if _, ok := origins[origin]; ok {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Vary", "Origin")
            c.Header("Access-Control-Allow-Credentials", "true")
            c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control")
            c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        }

        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }

        c.Next()
    }
}
