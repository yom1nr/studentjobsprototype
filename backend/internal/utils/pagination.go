package utils

import (
    "strconv"

    "github.com/gin-gonic/gin"
    "gorm.io/gorm"
)

// Pagination holds the normalized paging window parsed from the query string.
type Pagination struct {
    Page  int // 1-based
    Limit int // rows per page
}

// Offset is the SQL OFFSET for this window.
func (p Pagination) Offset() int { return (p.Page - 1) * p.Limit }

// ParsePagination reads ?page= and ?limit= with safe bounds:
//   - page  : >= 1        (default 1)
//   - limit : 1..100      (default 20, clamped)
func ParsePagination(c *gin.Context) Pagination {
    page := 1
    if v, err := strconv.Atoi(c.Query("page")); err == nil && v > 1 {
        page = v
    }

    limit := 20
    if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
        limit = v
    }
    if limit > 100 {
        limit = 100
    }

    return Pagination{Page: page, Limit: limit}
}

// Paginate is a GORM scope. Usage:
//
//	p := utils.ParsePagination(c)
//	db.Scopes(utils.Paginate(p)).Where(...).Find(&rows)
func Paginate(p Pagination) func(*gorm.DB) *gorm.DB {
    return func(d *gorm.DB) *gorm.DB {
        return d.Offset(p.Offset()).Limit(p.Limit)
    }
}
