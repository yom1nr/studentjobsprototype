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
