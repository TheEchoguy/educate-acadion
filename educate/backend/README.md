# Acadion Backend — Spring Boot 3 Academic Intelligence Engine

> **Enterprise REST API microservice powering institutional classroom isolation, dynamic syllabus tracking, 4-tier diagnostic rollups, and marksheet ingestion.**

[![Java 17+](https://img.shields.io/badge/Java-17%2B-ED8B00?logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Spring Boot 3.4.1](https://img.shields.io/badge/Spring%20Boot-3.4.1-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Spring Data MongoDB](https://img.shields.io/badge/Database-Spring%20Data%20MongoDB-47A248?logo=mongodb&logoColor=white)](https://spring.io/projects/spring-data-mongodb)
[![Spring Security 6](https://img.shields.io/badge/Security-Spring%20Security%206%20JWT-6DB33F?logo=springsecurity&logoColor=white)](https://spring.io/projects/spring-security)

---

## 🏛️ Architectural Overview

The backend is built on **Spring Boot 3.4.1** and **Java 17**, engineered for multi-tenant institutional isolation, outcome-based education (OBE) compliance, and high-throughput matrix ingestion.

```
com.acadion.backend/
├── config/             # Spring Security, CORS, MongoTemplate, and PasswordEncoder beans
├── controller/         # REST API Controllers (Classroom, Intelligence, IA Marks, Auth)
├── service/            # Core Business Logic & Hierarchical Rollup Orchestration
├── repository/         # Spring Data MongoDB Reactive/Query Repositories
├── entity/             # Document Entities (Classroom, MarksRecord, Blueprint, User)
├── dto/                # Request & Response Data Transfer Objects
└── security/           # Stateless JWT Authentication Filter & RBAC Authorization
```

---

## 🌟 Core Functional Capabilities

### 1. Multi-Classroom Isolation & Cryptographic Enrollment
- **Scoped Tenant Boundaries:** Enforces course, section, and academic batch isolation. Faculty and students cannot access or leak data across disparate classroom spaces.
- **Join-Code Cryptography:** Join codes are verified via SHA-256 hash digests (`joinCodeHash`) with automatic expiration and regeneration controls.
- **Roster Ingestion Engine:** Supports university Excel (.xlsx) and CSV rosters with multi-line title skips, duplicate detection, and idempotent student account auto-provisioning.

### 2. Unified IA Marks Ingestion & Split-Up Matrix Engine
- **Blueprint-Aligned Spreadsheets:** Generates Apache POI Excel mark-entry templates dynamically mapped to active question paper blueprints (sub-questions $Q1a, Q1b, \dots$).
- **Matrix Validation:** Rigorously verifies cell inputs against maximum question scores, handling choices (VTU Part A/B choices), non-attendances, and scaling rules.

### 3. 4-Level Diagnostic Rollup Hierarchy
- **Level 1 (Concept Mastery):** Atomic topic scoring with automated `<50%` weakness indicators.
- **Level 2 (Module Coverage):** Unit-by-unit syllabus progression tracking (Modules 1–5).
- **Level 3 (Subject Scaled CIE):** Scaled CIE calculator (e.g. VTU 40M $\rightarrow$ 15M scale + Lab 25M) and SEE targets.
- **Level 4 (Semester Standing):** Credit-weighted institutional standing and academic velocity.

---

## 🔐 Security Architecture

- **Stateless JWT Authentication:** HMAC-SHA256 tokens issued upon verification, containing user claims, USN, and role.
- **Role-Based Access Control (RBAC):** Strictly guards endpoints with `@PreAuthorize` and `SecurityFilterChain`:
  - `STUDENT`: Read-only access to enrolled classroom workspaces, personal diagnostics, and RAG tutor.
  - `TEACHER`: Workspace creation, question paper blueprinting, Excel roster/marks entry, and scheme publishing.
  - `ADMIN`: Institutional user approval, governance metrics, and department oversight.
- **Zero Hardcoded Secrets:** Backed entirely by environment variables (`SPRING_DATA_MONGODB_URI`, `APP_JWT_SECRET`).

---

## 🚀 Local Development & Build

### Prerequisites
- **JDK 17** or higher
- **Maven 3.9+** (or use the bundled `./mvnw`)
- **MongoDB Atlas** connection string or local MongoDB instance

### Configuration
Copy the sample configuration file and add your credentials:
```bash
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
```

### Build & Run
```bash
# Clean and compile
./mvnw clean test-compile

# Run unit and service test suites
./mvnw test -Dtest=*ServiceTest

# Start the Spring Boot API server (Port 8080)
./mvnw spring-boot:run
```
The server will initialize at `http://localhost:8080`.
