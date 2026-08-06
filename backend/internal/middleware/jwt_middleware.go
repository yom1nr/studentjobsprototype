package middleware

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/SA/Golang-Backend-Example/internal/utils"
)

// JWTAuthMiddleware validates the JWT token and attaches the user ID to the request context.
func JWTAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            utils.JSONError(c, http.StatusUnauthorized, "authorization header missing", "provide Authorization: Bearer <token>")
            c.Abort()
            return
        }

        if !strings.HasPrefix(authHeader, "Bearer ") {
            utils.JSONError(c, http.StatusUnauthorized, "invalid authorization header", "authorization type must be Bearer")
            c.Abort()
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        claims, err := utils.ParseToken(tokenString)
        if err != nil {
            utils.JSONError(c, http.StatusUnauthorized, "invalid token", err.Error())
            c.Abort()
            return
        }

        c.Set(utils.ContextUserIDKey, claims.UserID)
        c.Set(utils.ContextUserRoleKey, claims.Role)
        c.Next()
    }
}
