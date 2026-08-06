package models

import "gorm.io/gorm"

// Gender represents a gender type in the system. It embeds gorm.Model
// to include ID, CreatedAt, UpdatedAt and DeletedAt fields.
type Gender struct {
	gorm.Model
	Gender string `gorm:"size:50;not null" json:"gender"`
	// Users holds the relationship to users with this gender
	Users []User `gorm:"foreignKey:GenderID" json:"users,omitempty"`
}
