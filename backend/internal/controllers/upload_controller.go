package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/SA/Golang-Backend-Example/internal/utils"
)

// uploadDir is where uploaded files land, relative to the process working
// directory (/app in the container). It is git-ignored and served read-only
// at /uploads by the router.
const uploadDir = "uploads"

// maxUploadBytes caps a single upload at 5 MB.
const maxUploadBytes = 5 << 20

// allowedUploadTypes maps an accepted sniffed content-type to the extension we
// store the file under. The client-supplied filename is never trusted for the
// extension, so an .html or .svg renamed to .png can't be served back as active
// content from our origin.
var allowedUploadTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

// UploadController handles authenticated file uploads (profile images, employer
// documents, complaint evidence).
type UploadController struct{}

// NewUploadController creates a new UploadController.
func NewUploadController() *UploadController {
	return &UploadController{}
}

// UploadFile accepts one multipart "file" field, validates its size and type by
// sniffing the bytes, stores it under a random name, and returns { "url": ... }.
func (h *UploadController) UploadFile(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes+1024)

	if err := c.Request.ParseMultipartForm(maxUploadBytes); err != nil {
		utils.JSONError(c, http.StatusBadRequest, "upload failed", "file is too large (max 5MB) or the form is malformed")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.JSONError(c, http.StatusBadRequest, "upload failed", "no file provided in the 'file' field")
		return
	}
	defer file.Close()

	if header.Size > maxUploadBytes {
		utils.JSONError(c, http.StatusBadRequest, "upload failed", "file is too large (max 5MB)")
		return
	}

	// Sniff the real content type from the first 512 bytes.
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	contentType := http.DetectContentType(head[:n])
	ext, ok := allowedUploadTypes[contentType]
	if !ok {
		utils.JSONError(c, http.StatusBadRequest, "upload failed", "unsupported file type — allowed: JPG, PNG, WebP, PDF")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		utils.JSONInternalError(c, "upload failed", err)
		return
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		utils.JSONInternalError(c, "upload failed", err)
		return
	}

	name := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), randomToken(8), ext)
	dstPath := filepath.Join(uploadDir, name)

	dst, err := os.Create(dstPath)
	if err != nil {
		utils.JSONInternalError(c, "upload failed", err)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, io.LimitReader(file, maxUploadBytes)); err != nil {
		os.Remove(dstPath)
		utils.JSONInternalError(c, "upload failed", err)
		return
	}

	utils.JSONSuccess(c, http.StatusOK, gin.H{"url": "/uploads/" + name})
}

func randomToken(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
