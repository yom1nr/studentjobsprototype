package utils

import (
    "log"
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
)

// JSONSuccess sends a successful JSON response.
func JSONSuccess(c *gin.Context, status int, data interface{}) {
    if status == http.StatusNoContent {
        c.Status(http.StatusNoContent)
        return
    }
    c.JSON(status, gin.H{
        "success": true,
        "data":    data,
    })
}

// dbErrorMarkers are substrings that only appear in raw datastore/driver
// output, never in the human-readable detail our handlers write themselves
// (e.g. "email already in use", "current password is incorrect"). If a detail
// contains one it is leaking internals and gets scrubbed.
//
// This is an interim safety net so we don't have to touch ~100 call sites at
// once — the proper fix is for each controller to stop passing err.Error()
// and use JSONInternalError for datastore failures.
var dbErrorMarkers = []string{
    "sqlstate",
    "pq:",
    "pgx",
    "violates",
    "constraint",
    "gorm",
    "duplicate key",
    "syntax error",
    "dial tcp",
    "connection refused",
    "context deadline exceeded",
    "sql: ",
}

func looksLikeInternalError(detail string) bool {
    d := strings.ToLower(detail)
    for _, m := range dbErrorMarkers {
        if strings.Contains(d, m) {
            return true
        }
    }
    return false
}

// JSONError sends a structured error response. The detail is logged server-side
// and replaced with a generic string when the status is 5xx or the detail looks
// like a raw datastore/driver error, so internals never reach the client.
func JSONError(c *gin.Context, status int, message, detail string) {
    if detail != "" && (status >= http.StatusInternalServerError || looksLikeInternalError(detail)) {
        log.Printf("%s %s -> %d: %s | %s", c.Request.Method, c.Request.URL.Path, status, message, detail)
        detail = "an internal error occurred"
    }
    c.JSON(status, gin.H{
        "success": false,
        "error": gin.H{
            "message": message,
            "detail":  detail,
        },
    })
}

// JSONInternalError logs the underlying error and returns a generic 500 with no
// internal detail. Prefer this over passing err.Error() to JSONError for any
// datastore or infrastructure failure.
func JSONInternalError(c *gin.Context, message string, err error) {
    if err != nil {
        log.Printf("%s %s -> 500: %s | %v", c.Request.Method, c.Request.URL.Path, message, err)
    }
    c.JSON(http.StatusInternalServerError, gin.H{
        "success": false,
        "error": gin.H{
            "message": message,
            "detail":  "an internal error occurred",
        },
    })
}
