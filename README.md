# HRMS — Human Resource Management System

A full-stack HRMS app built around an IT-company workflow. Spring Boot backend, Angular frontend,
PostgreSQL persistence, JWT auth with role-based access. 12+ modules covering the typical Darwinbox
feature surface (employees, attendance, leaves, payroll, performance, documents, reimbursement,
travel, helpdesk, recruitment, social feed, etc.).

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Repository layout](#repository-layout)
3. [Quick start](#quick-start)
4. [Demo accounts](#demo-accounts)
5. [Modules overview](#modules-overview)
6. [API surface](#api-surface)
7. [Backend conventions](#backend-conventions)
8. [Frontend conventions](#frontend-conventions)
9. [Data seeding](#data-seeding)
10. [Configuration reference](#configuration-reference)
11. [Known caveats](#known-caveats)

---

## Tech stack

| Layer        | Tech                                                        |
|--------------|-------------------------------------------------------------|
| Backend      | Java 21 · Spring Boot 3.4 · Spring Security · Spring Data JPA · Lombok |
| Auth         | JWT (HS512 via `jjwt 0.12`) · BCrypt password hashing       |
| Database     | PostgreSQL 12+ (H2 fallback profile available)              |
| PDF          | Apache PDFBox (payslip generation)                          |
| Frontend     | Angular 19 (standalone components + signals + new control flow) · Reactive Forms · RxJS |
| Build        | Maven 3.9 (backend) · npm + Angular CLI (frontend)          |
| Ports        | Backend `:1112` · Frontend `:2168`                          |

---

## Repository layout

```
.
├── backend/                       Spring Boot service
│   ├── pom.xml
│   └── src/main/java/com/hrms/
│       ├── HrmsApplication.java
│       ├── auth/                  Login, password reset, change, admin reset
│       ├── attendance/            Check in/out, calendar, monthly summary
│       ├── bootstrap/             DataSeeder, PolicySeeder, BulkEmployeeSeeder
│       ├── documents/             HR document upload / download
│       ├── domain/                JPA entities + enums
│       ├── employee/              Employees + departments + photo upload
│       ├── helpdesk/              Tickets
│       ├── leave/                 Leave requests, balances
│       ├── notification/          In-app notifications
│       ├── payroll/               Salary structures, payslips, PDF
│       ├── performance/           Goals + reviews
│       ├── policy/                HR policies + acknowledgements
│       ├── recruitment/           Jobs + candidates + applications
│       ├── reimbursement/         Expense claims
│       ├── repo/                  Spring Data JPA repositories
│       ├── security/              JwtAuthFilter, JwtService, SecurityConfig, AuthPrincipal
│       ├── taskbox/               Unified pending-actions inbox
│       ├── travel/                Travel requests (PENDING → APPROVED → BOOKED → COMPLETED)
│       ├── vibe/                  Social feed: posts, reactions, comments
│       └── web/                   GlobalExceptionHandler
│
├── frontend/                      Angular 19 SPA
│   └── src/app/
│       ├── app.config.ts          Providers (router, http with JWT interceptor)
│       ├── app.routes.ts          Lazy-loaded route map
│       ├── core/                  Services, models, guards, interceptors, pipes
│       ├── auth/                  Login, forgot/reset/change password
│       ├── layout/                Shell (sidebar, top bar, app launcher, profile menu, bell)
│       ├── dashboard/             Module hub
│       ├── employees/             Directory, profile, edit, avatar
│       ├── attendance/            Calendar, team day-view
│       ├── leaves/                Tabs (balance / holidays / history) + apply drawer
│       ├── holidays/              Admin CRUD
│       ├── payroll/               My payslips + structures + generate
│       ├── performance/           My goals/reviews + team
│       ├── documents/             HR documents
│       ├── reimbursement/         Expense claims
│       ├── policies/              Markdown policy library + acks
│       ├── helpdesk/              Tickets
│       ├── travel/                Trip requests
│       ├── taskbox/               Unified inbox
│       ├── recruitment/           Jobs / Candidates / Pipeline kanban
│       └── vibe/                  Feed + composer
│
└── README.md                      (this file)
```

The `backend/uploads/` directory is created at runtime and stores:
- `employee-photos/` — employee profile pictures (`emp-{id}.{ext}`)
- `documents/{employeeId}/` — HR documents

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| JDK | 21+ (24 works) |
| Maven | 3.9+ |
| Node.js | 18+ (tested on 22) |
| Angular CLI | 19+ (bundled via `npm install`) |
| PostgreSQL | 12+ running on `localhost:5432` |

### 1 · Set up the database

```sql
CREATE DATABASE hrms;
-- Default credentials used by application.yml:
--   user:     postgres
--   password: root
-- Override with env vars DB_USER / DB_PASSWORD if needed.
```

### 2 · Run the backend

```bash
cd backend
mvn -DskipTests spring-boot:run
```

Backend boots on **http://localhost:1112**. On first run it:
- Auto-creates the schema via JPA `ddl-auto: update`
- Seeds 3 demo employees, 3 departments, leave balances, policies
- Seeds 500 additional IT-company employees via `BulkEmployeeSeeder` (≈50 s)

### 3 · Run the frontend

```bash
cd frontend
npm install   # first time only
npm start     # ng serve --port 2168
```

Frontend boots on **http://localhost:2168**.

### Postgres credentials

The default Postgres URL/credentials live in `backend/src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/hrms
    username: postgres
    password: root
```

Override with environment variables `DB_USER` / `DB_PASSWORD` if your local Postgres differs.

For an in-memory H2 sandbox instead, start with the `h2` profile:

```bash
SPRING_PROFILES_ACTIVE=h2 mvn -DskipTests spring-boot:run
```

---

## Demo accounts

The seeder creates three named accounts plus 500 generated employees.

| Role | Email | Password |
|------|-------|----------|
| ADMIN   | `admin@hrms.local`    | `admin123`    |
| MANAGER | `manager@hrms.local`  | `manager123`  |
| EMPLOYEE| `employee@hrms.local` | `employee123` |

Bulk-seeded employees use a deterministic naming scheme. Login as any of them with
`{firstName}123` lowercased — e.g. `rajan.patel41@amnex.local` / `rajan123`. Search the
Employees directory to find emails.

Role mapping for bulk-seeded employees:
- Bands 1–3 (trainees, individual contributors) → `EMPLOYEE`
- Bands 4–5 (senior ICs, leads, managers) → `MANAGER`
- Bands 6–7 (directors, principals) → `ADMIN`

---

## Modules overview

| Module          | Path             | Highlights                                                                            |
|-----------------|------------------|---------------------------------------------------------------------------------------|
| **Dashboard**   | `/dashboard`     | Module hub with stat tiles + quick links                                              |
| **Employees**   | `/employees`     | Directory with search-first UX + autocomplete; profile page with banner, tabs, org chart |
| **Profile**     | `/profile`       | Redirects to current user's `/employees/{id}`                                         |
| **Attendance**  | `/attendance/me` | Punch-in/out, monthly calendar (Sun-first), metrics, late marks, half-days            |
|                 | `/attendance/team` | Manager view of direct reports for any day                                          |
|                 | `/attendance/all`  | Admin view of org-wide attendance                                                   |
| **Leave**       | `/leaves/me`     | Tabs: balance cards · holidays · history                                              |
|                 | `/leaves/apply`  | Slide-in drawer to apply; balance check before submit                                 |
|                 | `/leaves/approvals` | Manager/admin pending decisions                                                    |
| **Holidays**    | `/holidays`      | Admin CRUD, year-based                                                                |
| **Payroll**     | `/payroll`       | Tabs: My Payslips · Salary Structure · Generate (admin). PDF download.                |
| **Performance** | `/performance`   | Goals (with weight + progress) · Reviews (1-5 stars). Per-team views for managers.    |
| **HR Documents**| `/documents`     | Upload by category (Aadhar / PAN / Resume / etc.); per-employee folders                |
| **Reimbursement** | `/reimbursement` | Expense claims with manager approval flow; monthly approved total                   |
| **HR Policies** | `/policies`      | Markdown policy library; acknowledgement tracking                                     |
| **Helpdesk**    | `/helpdesk`      | Tickets (IT/HR/Payroll/Facility/Security/Other) with status flow; admin can assign    |
| **Travel**      | `/travel`        | Trip requests: PENDING → APPROVED → BOOKED → COMPLETED                                |
| **Task Box**    | `/taskbox`       | Unified inbox: approvals, tickets assigned, policies to ack, your pending items       |
| **Recruitment** | `/recruitment`   | Jobs · Candidates · 6-stage Pipeline kanban (APPLIED → SCREENING → INTERVIEW → OFFER → HIRED / REJECTED) |
| **Vibe**        | `/vibe`          | Social feed: posts (Announcement / Kudos / Event / Question / General), reactions, comments, pinned posts |
| **Notifications** | top-bar bell   | In-app dropdown; fired by leave decisions, payslip release, ticket events, reimbursement, travel, helpdesk, recruitment, vibe |

---

## API surface

All endpoints are under `/api/*`. Authentication is required except for:
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/employees/*/photo` (avatar serving)

Pass the JWT as `Authorization: Bearer <token>`. The token returned by `/api/auth/login`
includes the role; `ROLE_ADMIN` / `ROLE_MANAGER` / `ROLE_EMPLOYEE` are enforced via
`@PreAuthorize`.

### Auth

```
POST /api/auth/login              { email, password }              → { token, userId, email, role, employee }
POST /api/auth/forgot-password    { email }                        → { message, devToken }
POST /api/auth/reset-password     { token, newPassword }
POST /api/auth/change-password    { currentPassword, newPassword }
```

### Employees & Org

```
GET  /api/employees                     ?q=&departmentId=
GET  /api/employees/{id}
GET  /api/employees/me
POST /api/employees                     (admin)
PUT  /api/employees/{id}                (admin)
DEL  /api/employees/{id}                (admin)
GET  /api/employees/{id}/org-chart      → { chain, reports }
POST /api/employees/{id}/reset-password (admin)
POST /api/employees/{id}/photo          (multipart)
GET  /api/employees/{id}/photo
DEL  /api/employees/{id}/photo

GET  /api/departments
POST /api/departments                   (admin)
```

### Attendance

```
POST /api/attendance/check-in
POST /api/attendance/check-out
GET  /api/attendance/today
GET  /api/attendance/me                 ?from=&to=
GET  /api/attendance/me/summary         ?year=&month=
GET  /api/attendance/employee/{id}      ?from=&to=    (mgr/admin)
GET  /api/attendance/team               ?date=         (manager)
GET  /api/attendance/all                ?date=         (admin)
```

### Leave

```
POST /api/leaves                                 (apply)
GET  /api/leaves/me
GET  /api/leaves/pending                          (mgr/admin)
GET  /api/leaves                                  (admin)
PUT  /api/leaves/{id}/approve                     (mgr/admin)
PUT  /api/leaves/{id}/reject                      (mgr/admin)
GET  /api/leaves/balance                          (mine)
GET  /api/leaves/balance/{employeeId}             (mgr/admin)
```

### Holidays

```
GET  /api/holidays                       ?year=
POST /api/holidays                       (admin)
PUT  /api/holidays/{id}                  (admin)
DEL  /api/holidays/{id}                  (admin)
```

### Payroll

```
GET  /api/payroll/structures/{employeeId}
POST /api/payroll/structures/{employeeId}              (admin/mgr)
PUT  /api/payroll/structures/id/{structureId}          (admin/mgr)
DEL  /api/payroll/structures/id/{structureId}          (admin)
POST /api/payroll/payslips/generate                    (admin)  { year, month, employeeId? }
GET  /api/payroll/payslips/me
GET  /api/payroll/payslips/employee/{id}               (mgr/admin)
GET  /api/payroll/payslips/month                       ?year=&month=
GET  /api/payroll/payslips/{id}
GET  /api/payroll/payslips/{id}/pdf
```

### Performance

```
GET  /api/performance/goals/me
GET  /api/performance/goals/employee/{id}              (mgr/admin)
GET  /api/performance/goals/team                       (mgr/admin)
POST /api/performance/goals/me
POST /api/performance/goals/employee/{id}              (mgr/admin)
PUT  /api/performance/goals/{goalId}
DEL  /api/performance/goals/{goalId}

GET  /api/performance/reviews/me
GET  /api/performance/reviews/employee/{id}
GET  /api/performance/reviews/team                     (mgr/admin)
POST /api/performance/reviews/employee/{id}            (mgr/admin)  (upsert by period)
DEL  /api/performance/reviews/{id}                     (admin)
```

### Documents (HR)

```
GET  /api/documents/me
GET  /api/documents/employee/{id}                      (mgr/admin)
POST /api/documents/me                                 (multipart)
POST /api/documents/employee/{id}                      (mgr/admin) (multipart)
GET  /api/documents/{docId}/file
DEL  /api/documents/{docId}
```

### Reimbursement

```
GET  /api/reimbursements/me
GET  /api/reimbursements/pending                       (mgr/admin)
GET  /api/reimbursements                               (admin)
GET  /api/reimbursements/me/stats
POST /api/reimbursements
PUT  /api/reimbursements/{id}/approve                  (mgr/admin)
PUT  /api/reimbursements/{id}/reject                   (mgr/admin)
DEL  /api/reimbursements/{id}
```

### HR Policies

```
GET  /api/policies                       ?category=
GET  /api/policies/{id}
GET  /api/policies/categories
POST /api/policies                       (admin)
PUT  /api/policies/{id}                  (admin)
DEL  /api/policies/{id}                  (admin)
POST /api/policies/{id}/ack
```

### Helpdesk

```
GET  /api/helpdesk/me
GET  /api/helpdesk/assigned-to-me
GET  /api/helpdesk                       ?status=    (admin)
GET  /api/helpdesk/stats                              (admin)
GET  /api/helpdesk/{id}
POST /api/helpdesk
PUT  /api/helpdesk/{id}/assign                        (admin)
PUT  /api/helpdesk/{id}/status
DEL  /api/helpdesk/{id}
```

### Travel

```
GET  /api/travel/me
GET  /api/travel/pending                              (mgr/admin)
GET  /api/travel                                       (admin)
GET  /api/travel/me/stats
POST /api/travel
PUT  /api/travel/{id}/approve                         (mgr/admin)
PUT  /api/travel/{id}/reject                          (mgr/admin)
PUT  /api/travel/{id}/mark-booked                     (mgr/admin)
PUT  /api/travel/{id}/mark-completed
PUT  /api/travel/{id}/cancel
DEL  /api/travel/{id}
```

### Task Box

```
GET  /api/taskbox    → { total, approvals, assignedToMe, policyAcks, myPending }
```

### Recruitment

```
GET  /api/recruitment/jobs               ?status=
GET  /api/recruitment/jobs/{id}
POST /api/recruitment/jobs                              (mgr/admin)
PUT  /api/recruitment/jobs/{id}                         (mgr/admin)
DEL  /api/recruitment/jobs/{id}                         (admin)

GET  /api/recruitment/candidates         ?q=
GET  /api/recruitment/candidates/{id}
POST /api/recruitment/candidates
PUT  /api/recruitment/candidates/{id}                   (mgr/admin)
DEL  /api/recruitment/candidates/{id}                   (admin)

GET  /api/recruitment/applications/by-job/{jobId}
GET  /api/recruitment/applications/by-candidate/{candidateId}
GET  /api/recruitment/pipeline                          (mgr/admin)
POST /api/recruitment/applications                      (mgr/admin)
PUT  /api/recruitment/applications/{id}/stage           (mgr/admin)
DEL  /api/recruitment/applications/{id}                 (mgr/admin)
```

### Vibe

```
GET  /api/vibe/posts                     ?category=&limit=
GET  /api/vibe/posts/{id}
POST /api/vibe/posts                     { category, body, subjectEmployeeId?, pinned? }
DEL  /api/vibe/posts/{id}                (author or admin)
PUT  /api/vibe/posts/{id}/pin            (admin)
POST /api/vibe/posts/{id}/react          { type }                  (toggle)
POST /api/vibe/posts/{id}/comments       { body }
DEL  /api/vibe/comments/{id}             (author or admin)
```

### Notifications

```
GET  /api/notifications                  ?limit=
GET  /api/notifications/unread-count
PUT  /api/notifications/{id}/read
PUT  /api/notifications/read-all
```

---

## Backend conventions

- **Package-by-feature**: each module gets its own package under `com.hrms.<module>` containing
  controller(s) and feature-specific DTOs / services. Entities live in `com.hrms.domain`
  and repositories in `com.hrms.repo` so they can be reused across modules.
- **JWT auth**: `JwtAuthFilter` parses the bearer token, loads the `UserAccount` and stamps
  the security context with `ROLE_{ADMIN|MANAGER|EMPLOYEE}`. The principal is the full
  `UserAccount` object (helper: `AuthPrincipal.current()`).
- **Permissions**: a mix of `@PreAuthorize("hasRole('…')")` on controller methods for coarse-grain
  checks, plus per-method `ensureCanXxx(...)` helpers when the rule depends on the data
  (e.g. "only the owning manager can decide on this leave").
- **DTOs are records**. Entities are never returned directly from controllers — they're always
  mapped to view records by the service or controller. This avoids leaking JPA proxies into
  Jackson serialization.
- **Eager vs lazy fetches** — `UserAccount.employee` and several `*.employee` fields are
  EAGER so the security principal can be used without a session. When a method reloads an
  employee from the repo (`employees.findById(id)`) inside `@Transactional`, downstream
  lazy proxies (`employee.department`, `employee.manager`) resolve correctly. If you see
  `LazyInitializationException`, you almost certainly need to reload the entity inside the
  transaction or annotate the controller method `@Transactional(readOnly = true)`.
- **Idempotent seeders**: `DataSeeder` only seeds users on a fresh DB; `PolicySeeder` and
  `BulkEmployeeSeeder` are idempotent per-row so restarts don't double up. Holidays and
  salary structures are also idempotent.
- **Schema drift**: JPA's `ddl-auto: update` can add nullable columns but **cannot add
  `NOT NULL` columns to existing tables**. New non-nullable columns must use
  `columnDefinition = "... default ..."` so Postgres can backfill — see `Employee.active`
  and `SalaryStructure.createdAt`.

---

## Frontend conventions

- **Angular 19 standalone components** with **signals** and the new control-flow syntax
  (`@if` / `@for` / `@switch`). No NgModules.
- **Lazy routes** in `app.routes.ts` — each page is a separate chunk.
- **Auth interceptor** (`core/auth.interceptor.ts`) attaches the JWT and triggers logout on
  any 401.
- **`SafeHtmlPipe`** is used for every `[innerHTML]` binding that injects SVG icons; without
  it, Angular's HTML sanitizer strips attributes and the icons render invisibly.
- **`MarkdownLitePipe`** (`core/markdown.pipe.ts`) is a small custom markdown renderer
  for HR policies. Handles headings, lists, bold/italic, code, and pipe tables.
- **Drawer pattern**: most "create / edit" forms slide in as a right-anchored drawer
  (`/leaves/apply`, payslip detail, performance goal/review, ticket creation, etc.). The
  CSS structure is repeated per page rather than abstracted, which keeps each page
  self-contained at the cost of some duplication.
- **Theme**: a Darwinbox-inspired green palette is defined in `src/styles.css` via CSS
  variables (`--primary`, `--primary-soft`, `--accent`, etc.). All modules use the same
  base classes (`.card`, `.btn`, `.btn-primary`, `.tile`, `.badge`, `.table`, `.field`).
- **App launcher**: top-left grid icon opens a slide-in dark panel listing all 20+ modules.
  Recently-used + alphabetical with category tags. Coming-soon tiles are dimmed but visible.

---

## Data seeding

Three seeders run at startup:

1. **`DataSeeder`** — only runs if the `user_account` table is empty:
   - 3 departments: IT, HR, Finance
   - 3 demo employees: Aria Admin (admin), Mira Manager (mgr, IT), Eli Employee (emp, IT)
   - 3 user accounts with the passwords listed above
   - 1 pending leave for Eli (for demo)
   - 6 standard holidays
   - Salary structures for the 3 demo employees (idempotent path runs on every boot)

2. **`PolicySeeder`** — runs only if `policy` table is empty. Seeds 6 demo policies
   (Leave / Attendance / Code of Conduct / Remote Work / Reimbursement / Information Security)
   with markdown bodies.

3. **`BulkEmployeeSeeder`** — runs only when `employee_count < 50` AND > 0. Adds 500
   IT-company employees across 9 departments:

   | Department         | Approx. share |
   |--------------------|---------------|
   | Engineering        | 62 %          |
   | QA                 | 7 %           |
   | Design             | 6 %           |
   | DevOps             | 5 %           |
   | Data               | 5 %           |
   | Sales / Marketing / Finance / People / Product | balance |

   Each gets a realistic Indian name (53 male + 44 female first names × 48 surnames),
   graded designation, a manager from a higher band in the same department, a salary
   structure scaled to the band, a city, phone, login account (`{firstname}123`), leave
   balance allocation, and a role mapping (band ≥ 6 → ADMIN, ≥ 4 → MANAGER, else EMPLOYEE).

To re-run the bulk seed from scratch, drop all employees beyond the 3 demo ones:

```sql
DELETE FROM user_account WHERE employee_id > 3;
DELETE FROM salary_structure WHERE employee_id > 3;
DELETE FROM leave_balance    WHERE employee_id > 3;
DELETE FROM employee WHERE id > 3;
```

…then restart the backend.

---

## Configuration reference

All env vars are optional — defaults work for a local Postgres setup.

| Variable                    | Default                                 | Notes                              |
|-----------------------------|-----------------------------------------|------------------------------------|
| `DB_USER`                   | `postgres`                              | Postgres user                      |
| `DB_PASSWORD`               | `root`                                  | Postgres password                  |
| `HRMS_JWT_SECRET`           | dev placeholder (32+ bytes)             | **Change for any non-local use**   |
| `HRMS_PHOTO_DIR`            | `uploads/employee-photos`               | Path for employee photos           |
| `hrms.uploads.dir`          | `uploads`                               | Base path for HR documents         |
| `hrms.uploads.max-photo-bytes` | `5242880` (5 MB)                     | Photo upload size cap              |
| `SPRING_PROFILES_ACTIVE`    | `postgres`                              | Use `h2` for an in-memory DB       |

Multipart file size is capped at 5 MB for photos and 15 MB for HR documents in
`application.yml`.

---

## Known caveats

These are deliberate cuts to keep the project boot-able and demo-friendly. None are blockers
for the happy paths above, but worth knowing before extending the project.

1. **Forgot-password returns the token in the response body.** There's no email
   service wired up; in production replace `PasswordController.forgot` with an outbound
   email send.
2. **Document MIME validation is by `Content-Type` header.** A malicious client could lie
   about the type. Add real magic-byte sniffing (Apache Tika) before accepting uploads in
   any non-trusted environment.
3. **Leave balance counts calendar days**, not working days (weekends/holidays aren't
   subtracted from the requested range). Fine for the demo's `12 / 12 / 21` allotments;
   plug in a working-day calculator if you want stricter accounting.
4. **Payslip generation skips zero-paid-days months.** Generating for an employee who has
   no attendance records that month is a no-op (mirrors real payroll behavior). To test the
   PDF path, ensure at least one PRESENT / HALF_DAY record exists for the period.
5. **No file cleanup on employee delete.** Deleting an employee leaves their photo and
   uploaded documents on disk. Add a cascade if you care.
6. **No audit logs (yet).** A cross-cutting audit log table is planned but not implemented.
7. **No workflow engine (Flows).** Approval rules are hard-coded per module (e.g. "the
   employee's manager OR admin"). A configurable flows engine is on the roadmap.
8. **Recruitment doesn't store resumes.** Candidate records carry a `resumeFilename` field
   but file upload for resumes isn't wired through (re-use the HR Documents endpoint if needed).
9. **Vibe doesn't paginate** — the feed endpoint returns the most recent 50 posts. Fine for a
   single-org demo; add a cursor if the post count is going to grow.

---

## Quick troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERROR: column foo.bar does not exist` on startup | New `NOT NULL` column added without a default; JPA can't backfill | Add `columnDefinition = "… default …"` to the entity field, OR `ALTER TABLE` manually |
| `LazyInitializationException` from a controller | Accessing a lazy field on a detached entity (e.g. `AuthPrincipal.current().getEmployee()`'s manager) | Reload via repo inside a `@Transactional` method |
| `Ambiguous mapping` for `/api/employees/{id}/photo` | Two controllers map the same URL | Delete the older one (the canonical handlers live in `EmployeeController`) |
| `function lower(bytea) does not exist` | Postgres can't infer the type of a NULL bind in a string function | Replace `null` with empty string in the service before calling the repo, or cast in JPQL |
| Frontend icons missing | Angular's HTML sanitizer is stripping inline SVG attributes | Use the `safeHtml` pipe on the `[innerHTML]` binding |
| Login as a bulk-seeded employee fails | Password was rotated by a test, OR you typed the wrong slug | Reset via admin: `POST /api/employees/{id}/reset-password` with `{ "newPassword": "..." }` |

---

## License

This is a demo / internal project. No license attached; treat as proprietary unless
otherwise noted.
