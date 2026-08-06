package utils

import (
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

// JSONError sends a structured error response.
func JSONError(c *gin.Context, status int, message, detail string) {
    c.JSON(status, gin.H{
        "success": false,
        "error": gin.H{
            "message": message,
            "detail":  detail,
        },
    })
}
