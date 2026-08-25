# Student Jobs — T04

ระบบจัดหางานพาร์ทไทม์สำหรับนักศึกษา เชื่อมนักศึกษา ผู้ประกอบการ และเจ้าหน้าที่มหาวิทยาลัยไว้ในที่เดียว — ตั้งแต่ค้นหา/สมัครงาน สัมภาษณ์ เซ็นสัญญาจ้าง บันทึกเวลาทำงาน จ่ายค่าตอบแทน ไปจนถึงแจ้งปัญหา/ร้องเรียน

โปรเจกต์แบ่งเป็น 2 ส่วน รันแยกกัน:

- `backend/` — Go (Gin + GORM + PostgreSQL), เสิร์ฟ REST API ที่ `:8080`
- `frontend/` — React + TypeScript + Vite + MUI, เสิร์ฟที่ `:5173`

## สิ่งที่ต้องติดตั้งก่อน

- [Go](https://go.dev/dl/) 1.22 ขึ้นไป
- [Node.js](https://nodejs.org/) 18 ขึ้นไป (มี npm มาด้วย)
- PostgreSQL — จะรันเองในเครื่อง หรือใช้ Docker ก็ได้ (ดูตัวเลือกด้านล่าง)

## 1. เตรียมฐานข้อมูล PostgreSQL

ใช้ Docker ที่ง่ายที่สุด (ถ้ามี Docker Desktop):

```bash
docker run -d --name sat04-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec -it sat04-postgres psql -U postgres -c "CREATE DATABASE sat04db;"
```

หรือถ้ามี PostgreSQL ติดตั้งในเครื่องอยู่แล้ว แค่สร้างฐานข้อมูลชื่อ `sat04db` ด้วย user/password อะไรก็ได้ที่คุณตั้งไว้

ไม่ต้องรัน migration เอง — backend จะสร้างตาราง (GORM AutoMigrate) และ seed ข้อมูลทดสอบให้อัตโนมัติตอนรันครั้งแรก

## 2. รัน Backend

```bash
cd backend
copy .env.example .env    # (บน Windows PowerShell/cmd) หรือ cp .env.example .env บน bash
```

แก้ `.env` ให้ตรงกับ Postgres ที่เตรียมไว้ (ค่า default ใช้ได้เลยถ้าทำตามขั้นตอนที่ 1 ด้วย Docker):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=sat04db
JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=24h
SERVER_PORT=8080
```

ติดตั้ง dependency แล้วรันเซิร์ฟเวอร์:

```bash
go mod tidy
go run ./cmd/server
```

> **ถ้าอยู่บน Windows แล้วเจอ error ประมาณ "An Application Control policy has blocked this file"** เวลารัน `go run` — เครื่องบล็อกไฟล์ที่ build ไปแคชชั่วคราว ให้ build ไปไว้ในโปรเจกต์แทน:
> ```bash
> go build -o ./bin/server.exe ./cmd/server
> ./bin/server.exe
> ```

รันสำเร็จจะเห็น log ว่า server ฟังอยู่ที่ `:8080` และมี log สร้าง seed user ให้ (ดูรายชื่อบัญชีทดสอบด้านล่าง)

## 3. รัน Frontend

เปิด terminal ใหม่อีกอัน:

```bash
cd frontend
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:5173**

ค่า default จะเรียก backend ที่ `http://localhost:8080` อยู่แล้ว ถ้า backend รันคนละพอร์ต ให้สร้างไฟล์ `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## บัญชีทดสอบ (สร้างให้อัตโนมัติตอน backend รันครั้งแรกกับฐานข้อมูลเปล่า)

| Role | Email | Password |
|---|---|---|
| นักศึกษา | `somchai@example.com` | `password123` |
| ผู้ประกอบการ | `somying@example.com` | `securepass456` |
| แอดมิน (เจ้าหน้าที่มหาวิทยาลัย) | `sompong@example.com` | `adminpass789` |

หน้าแรกที่ยังไม่ login (`/`) จะเป็น landing page — กด "เริ่มต้นหางานเลย" เพื่อดูประกาศงานแบบไม่ต้อง login ได้เลย หรือกด "เข้าสู่ระบบ" แล้วใช้บัญชีด้านบน

## โครงสร้างโปรเจกต์ (คร่าว ๆ)

```
backend/
  cmd/server/          จุดเริ่มโปรแกรม
  internal/config/     การเชื่อมต่อ DB + seeder
  internal/models/     GORM models
  internal/dto/        request/response payload
  internal/controllers/ business logic ต่อ endpoint
  internal/routes/      ผูก route ทั้งหมด
  internal/middleware/  JWT auth / role guard

frontend/
  src/pages/            หน้าแต่ละหน้า แยกตาม role ในไฟล์เดียวกัน (ดู useAuth().user.role)
  src/services/https/   ฟังก์ชันเรียก API (fetch wrapper)
  src/interface/        TypeScript types ของแต่ละ endpoint
  src/routes/            ผูก route ของ React Router
```

## คำสั่งอื่นที่มีประโยชน์

```bash
# backend
cd backend && go build ./...   # เช็คว่า compile ผ่าน
cd backend && go vet ./...     # เช็ค lint

# frontend
cd frontend && npx tsc --noEmit   # เช็ค TypeScript
cd frontend && npm run lint       # เช็ค ESLint
cd frontend && npm run build      # build production
```
