package middleware

import (
    "net/http"

    "github.com/gin-gonic/gin"

    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// RequireRole restricts a route group to users whose JWT role claim is in the
// allowed list. Must run after JWTAuthMiddleware, which populates the role claim.
func RequireRole(roles ...string) gin.HandlerFunc {
    allowed := make(map[string]struct{}, len(roles))
    for _, r := range roles {
        allowed[r] = struct{}{}
    }

    return func(c *gin.Context) {
        role, ok := utils.GetUserRoleFromContext(c)
        if !ok {
            utils.JSONError(c, http.StatusForbidden, "access denied", "role missing from token")
            c.Abort()
            return
        }

        if _, permitted := allowed[role]; !permitted {
            utils.JSONError(c, http.StatusForbidden, "access denied", "insufficient role permissions")
            c.Abort()
            return
        }

        c.Next()
    }
}
