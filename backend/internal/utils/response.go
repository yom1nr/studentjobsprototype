package utils

import (
    "log"
    "net/http"

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

// JSONError sends a structured error response. For 5xx statuses the detail is
// logged server-side and replaced with a generic string so raw driver/internal
// errors never reach the client.
func JSONError(c *gin.Context, status int, message, detail string) {
    if status >= http.StatusInternalServerError && detail != "" {
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
// internal detail. Prefer this over passing err.Error() to JSONError.
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
