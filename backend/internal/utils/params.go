package utils

import (
    "strconv"

    "github.com/gin-gonic/gin"
)

// ParseUintParam reads and parses a uint path parameter by name.
func ParseUintParam(c *gin.Context, name string) (uint, error) {
    value, err := strconv.ParseUint(c.Param(name), 10, 64)
    if err != nil {
        return 0, err
    }
    return uint(value), nil
}

// ReadPage reads optional ?limit and ?offset query params for list endpoints.
// A missing or non-positive limit yields -1 ("no limit" for GORM), so callers
// stay backward-compatible with clients that don't page. limit is capped at
// maxLimit; offset defaults to 0.
func ReadPage(c *gin.Context, maxLimit int) (limit, offset int) {
    limit = -1
    if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
        limit = v
        if limit > maxLimit {
            limit = maxLimit
        }
    }
    if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
        offset = v
    }
    return limit, offset
}
