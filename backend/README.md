# Golang Example Backend

A beginner-friendly REST API backend built with Go, Gin, GORM, PostgreSQL, JWT authentication, bcrypt password hashing, and a simplified controller-based architecture.

## Features

- User registration
- User login
- JWT authentication and protected routes
- Get current user profile
- Update user profile
- Delete user profile
- Get all users
- PostgreSQL database with GORM migrations
- Environment variables from `.env`

## Project Structure

- `cmd/` — application entry point
- `internal/config/` — configuration and database connection
- `internal/models/` — database models
- `internal/dto/` — request/response payloads
- `internal/controllers/` — HTTP controllers containing application logic
- `internal/middleware/` — JWT auth middleware
- `internal/routes/` — route definition and registration
- `internal/utils/` — JWT, password, and response helpers

## Architecture

This version uses a simple flow:

Route -> Controller -> Database

Controllers encapsulate request validation, business rules, and database queries in one place for easier study and faster learning.

## Setup

1. Install prerequisites:
   - Go 1.22 or newer
   - Docker and Docker Compose

2. Open the project folder.

3. Start PostgreSQL and pgAdmin with Docker Compose:

```bash
docker compose up -d
```

4. Create a `.env` file in the project root with the following values:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=golangdb
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=24h
SERVER_PORT=8080
```

5. Download dependencies:

```bash
go mod tidy
```

6. Run the server:

```bash
go run ./cmd/server
```

7. Open the API on `http://localhost:8080` or your configured `SERVER_PORT`.

## API Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/profile`
- `PUT /api/v1/users/profile`
- `DELETE /api/v1/users/profile`
- `GET /api/v1/users`
- `GET /api/v1/users/{id}`

## Example cURL

### Register

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Secret123"}'
```

### Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123"}'
```

### Get profile

```bash
curl http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Update profile

```bash
curl -X PUT http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated","password":"NewSecret123"}'
```

### Delete profile

```bash
curl -X DELETE http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Get all users

```bash
curl http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Get user by ID

```bash
curl http://localhost:8080/api/v1/users/1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Notes

- The application now uses controllers only, without separate `handlers`, `services`, or `repositories` layers.
- Passwords are hashed with bcrypt.
- JWT tokens are signed with a secret loaded from environment variables.
- Routes are defined in `internal/routes/` and dispatched to controller methods.
