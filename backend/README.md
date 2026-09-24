# Backend — LKStore

Core e-commerce backend for **LKStore**, providing RESTful APIs for managing products, orders, and users.

## Tech Stack

- Java 17+, Spring Boot 3 (Web, Session, Data MongoDB)
- MongoDB (via Docker)
- Thymeleaf + Tailwind CSS (server-side rendering)
- Maven

## Prerequisites

- JDK 17+
- Docker Desktop

## Setup & Run

### 1. Start MongoDB

```bash
docker-compose up -d
```

### 2. Run the application

```bash
# Windows
mvnw.cmd spring-boot:run

# macOS / Linux
./mvnw spring-boot:run
```

The server starts at **http://localhost:8080**

> On the first run, sample data from `data/*.json` is automatically seeded into MongoDB.

## Configuration

| File | Purpose |
|------|---------|
| `src/main/resources/application.yaml` | Main config (DB connection, seeder toggle) |
| `src/main/resources/application-local.yaml` | Local overrides (admin password, etc.) |

**Data seeder:** Disabled by default to preserve data across restarts.  
To re-seed from JSON files, set `app.seeder.enabled: true` in `application.yaml`.

## Test Accounts

| Role | Credential |
|------|-----------|
| Customer | `emma.brown5032@example.com` / any password |
| Admin | `/admin/login` → password: `admin123` |
