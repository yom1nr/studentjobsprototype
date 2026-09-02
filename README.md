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

เปิด Docker Desktop ให้ขึ้นก่อน (รอจนไอคอนวาฬนิ่ง) แล้วสร้าง container:

```bash
docker run -d --name sat04-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec sat04-postgres psql -U postgres -c "CREATE DATABASE sat04db;"
```

> **ถ้าเจอ `port is already allocated`** แปลว่ามี PostgreSQL ตัวอื่นจองพอร์ต 5432 อยู่แล้ว (เช่น container ของวิชาอื่น) — ไม่ต้องสร้างตัวใหม่ ใช้ตัวเดิมได้เลย แค่สร้างฐานข้อมูลเพิ่มเข้าไป:
> ```bash
> docker ps                                    # ดูว่าตัวไหนจองพอร์ต 5432 อยู่
> docker exec <ชื่อ-container> psql -U <user> -c "CREATE DATABASE sat04db;"
> ```
> แล้วจำ user/password ของ container ตัวนั้นไว้ใช้ในขั้นตอนที่ 2

หรือถ้ามี PostgreSQL ติดตั้งในเครื่องอยู่แล้ว แค่สร้างฐานข้อมูลชื่อ `sat04db` ด้วย user/password อะไรก็ได้ที่คุณตั้งไว้

ไม่ต้องรัน migration เอง — backend จะสร้างตาราง (GORM AutoMigrate) และ seed ข้อมูลทดสอบให้อัตโนมัติตอนรันครั้งแรก

> `backend/compose.yml` เป็นไฟล์จากเทมเพลตตั้งต้น (สร้าง DB ชื่อ `golangdb`) **ไม่ได้ใช้กับโปรเจกต์นี้** — ทำตามขั้นตอนด้านบนแทน

## 2. รัน Backend

สร้างไฟล์ `backend/.env` ขึ้นมาเอง (ไม่มีมาให้ในโปรเจกต์ และ git ไม่เก็บไฟล์นี้) แล้วใส่ค่าให้ตรงกับ Postgres ที่เตรียมไว้ในขั้นตอนที่ 1:

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

> `DB_USER` / `DB_PASSWORD` ต้องตรงกับ container ที่ใช้จริง — ค่า `postgres/postgres` ด้านบนใช้ได้เมื่อสร้าง container ใหม่ตามขั้นตอนที่ 1 แต่ถ้าไปใช้ Postgres ตัวที่มีอยู่แล้ว ต้องเปลี่ยนเป็น user/password ของตัวนั้น

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

> **ทดสอบหลาย role พร้อมกัน ให้ใช้หน้าต่าง Incognito แยก** — token เก็บใน `localStorage` ซึ่งใช้ร่วมกันทุกแท็บของเบราว์เซอร์เดียวกัน ถ้า login คนละ role คนละแท็บแบบปกติ อันหลังจะทับอันแรกทันที

## รันครั้งต่อไป (ตั้งค่าครบแล้ว)

หลังตั้งค่าครั้งแรกเสร็จ วันต่อ ๆ ไปเหลือแค่ 3 ขั้น:

1. เปิด Docker Desktop แล้วรอจนพร้อม (ปกติ container จะเด้งขึ้นเอง เช็คด้วย `docker ps` — ถ้าไม่ขึ้นสั่ง `docker start sat04-postgres`)
2. terminal ที่ 1 — `cd backend` แล้ว `go run ./cmd/server`
3. terminal ที่ 2 — `cd frontend` แล้ว `npm run dev`

ทั้งสอง terminal ต้องเปิดค้างไว้ (ปิด = เซิร์ฟเวอร์ดับ) หยุดด้วย `Ctrl + C` และหยุดฐานข้อมูลด้วย `docker stop sat04-postgres` (ข้อมูลไม่หาย เก็บอยู่ใน volume)

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `failed to connect to the docker API` | Docker Desktop ยังไม่เปิด หรือเปิดยังไม่เสร็จ |
| backend ขึ้น `connection refused` ตอนต่อ DB | container ฐานข้อมูลไม่ได้รัน → `docker ps` แล้ว `docker start <ชื่อ>` |
| `port is already allocated` ตอนสร้าง container | มี Postgres ตัวอื่นจองพอร์ต 5432 อยู่ → ดูวิธีใช้ตัวเดิมในขั้นตอนที่ 1 |
| `password authentication failed` | `DB_USER` / `DB_PASSWORD` ใน `.env` ไม่ตรงกับ container ที่ใช้จริง |
| `database "sat04db" does not exist` | ยังไม่ได้สร้าง DB → ทำขั้นตอนที่ 1 ให้ครบ |
| หน้าเว็บโหลดข้อมูลไม่ได้ / ขึ้น error สีแดง | backend ดับ → ดู terminal ที่ 1 |
| เมนู/สิทธิ์ขึ้นผิด role | login หลาย role ในเบราว์เซอร์เดียวกัน → refresh แล้ว login ใหม่ หรือใช้ Incognito แยก |

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
