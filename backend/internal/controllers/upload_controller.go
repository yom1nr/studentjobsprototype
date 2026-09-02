package controllers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// UploadController handles file uploads.
type UploadController struct{}

// NewUploadController creates a new UploadController.
func NewUploadController() *UploadController {
	return &UploadController{}
}

// UploadFile handles multipart form file uploads and saves them to the "uploads" directory.
func (h *UploadController) UploadFile(c *gin.Context) {
	// Parse the multipart form, 10 MB max memory
	err := c.Request.ParseMultipartForm(10 << 20)
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "invalid multipart form", err.Error())
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "missing file", "no file provided in the request")
		return
	}
	defer file.Close()

	// Ensure uploads directory exists
	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		utils.JSONInternalError(c, "failed to create upload directory", err)
		return
	}

	// Create a unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), "upload", ext)
	dstPath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		utils.JSONInternalError(c, "failed to save file", err)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		utils.JSONInternalError(c, "failed to write file", err)
		return
	}

	// Return the URL path
	fileURL := fmt.Sprintf("/uploads/%s", filename)
	utils.JSONSuccess(c, http.StatusOK, gin.H{
		"url": fileURL,
	})
}
