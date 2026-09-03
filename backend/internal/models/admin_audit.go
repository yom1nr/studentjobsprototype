package models

import "gorm.io/gorm"

// AdminAuditLog records every admin-initiated change to another account's
// profile (employer/student directory edits, and later approve/reject/verify).
// AdminEmail/TargetLabel are denormalised snapshots so the log stays readable
// even if the admin or target row is later removed. Changes is a JSON object
// of the shape {"field": {"from": "...", "to": "..."}} covering only the
// fields that actually changed.
type AdminAuditLog struct {
	gorm.Model
	AdminID     *uint  `gorm:"index" json:"admin_id"`
	AdminEmail  string `gorm:"size:150" json:"admin_email"`
	Action      string `gorm:"size:50;not null;index" json:"action"`
	TargetType  string `gorm:"size:30;not null;index" json:"target_type"`
	TargetID    uint   `gorm:"not null;index" json:"target_id"`
	TargetLabel string `gorm:"size:200" json:"target_label"`
	Changes     string `gorm:"type:text" json:"changes"`
	IPAddress   string `gorm:"size:64" json:"ip_address"`
}
