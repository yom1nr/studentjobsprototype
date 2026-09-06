// Package testsupport provides a real-Postgres test database for controller
// integration tests. It is only ever imported from _test.go files, so it
// never ships in the server binary.
package testsupport

import (
	"io"
	"log"
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/SA/Golang-Backend-Example/internal/config"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// SetupTestDB drops and recreates a dedicated test database, then runs the
// same migration path production uses (config.ConnectDatabase), so
// integration tests exercise the real schema instead of a hand-rolled one.
//
// Connection details default to the project's standard local Docker
// Postgres (see CLAUDE.md) and can be overridden with TEST_DB_HOST /
// TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD / TEST_DB_NAME. If Postgres
// isn't reachable, the test is skipped rather than failed, so `go test ./...`
// still passes in environments without Docker running.
func SetupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	host := envOr("TEST_DB_HOST", "localhost")
	port := envOr("TEST_DB_PORT", "5432")
	user := envOr("TEST_DB_USER", "postgres")
	password := envOr("TEST_DB_PASSWORD", "postgres")
	dbName := envOr("TEST_DB_NAME", "sat04db_test")

	adminDSN := "host=" + host + " user=" + user + " password=" + password +
		" dbname=postgres port=" + port + " sslmode=disable TimeZone=UTC"
	admin, err := gorm.Open(postgres.Open(adminDSN), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	if err != nil {
		t.Skipf("skipping: test postgres not reachable at %s:%s (%v)", host, port, err)
	}
	sqlDB, err := admin.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	// Terminate any lingering connections from a previous run, then rebuild
	// the database from scratch so each test run starts from a clean schema.
	admin.Exec("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ? AND pid <> pg_backend_pid()", dbName)
	if err := admin.Exec("DROP DATABASE IF EXISTS " + dbName).Error; err != nil {
		t.Fatalf("drop test database: %v", err)
	}
	if err := admin.Exec("CREATE DATABASE " + dbName).Error; err != nil {
		t.Fatalf("create test database: %v", err)
	}

	cfg := &config.Config{
		DBHost:     host,
		DBPort:     port,
		DBUser:     user,
		DBPassword: password,
		DBName:     dbName,
		JWTSecret:  "test-secret",
	}

	// SeedDatabase (called by ConnectDatabase) logs every row it creates via
	// the standard logger; muted here so `go test` output stays readable.
	defaultLogOutput := log.Writer()
	log.SetOutput(io.Discard)
	db, err := config.ConnectDatabase(cfg)
	log.SetOutput(defaultLogOutput)
	if err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	db = db.Session(&gorm.Session{Logger: gormlogger.Default.LogMode(gormlogger.Silent)})

	t.Cleanup(func() {
		if underlying, err := db.DB(); err == nil {
			underlying.Close()
		}
	})

	return db
}
