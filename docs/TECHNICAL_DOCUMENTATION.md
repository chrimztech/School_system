# SRMS Frontend — Technical Documentation

**School Records Management System (SRMS) — Web Frontend**
TanStack Start (React 19) + TanStack Router/Query + Tailwind CSS + shadcn/radix-ui, deployed on Cloudflare Workers.

This app is the UI for the SRMS platform. It talks to the SRMS API (sibling repo `School_system-api`, Spring Boot) over REST. See that repo's `docs/TECHNICAL_DOCUMENTATION.md` for backend details.

---

## Table of Contents

1. [Overview & Tech Stack](#1-overview--tech-stack)
2. [App Architecture](#2-app-architecture)
3. [Authentication & Session](#3-authentication--session)
4. [Roles & Access Control](#4-roles--access-control)
5. [Navigation Structure](#5-navigation-structure)
6. [Route Inventory](#6-route-inventory)
7. [Configuration & Environment Variables](#7-configuration--environment-variables)
8. [Running Locally](#8-running-locally)
9. [Build & Deployment](#9-build--deployment)
10. [Project Conventions](#10-project-conventions)

---

## 1. Overview & Tech Stack

| Concern | Technology |
|---|---|
| Framework | TanStack Start (SSR React 19) |
| Routing | TanStack Router, file-based (`src/routes/*.tsx`) |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + zod resolvers |
| Styling | Tailwind CSS v4 |
| UI components | shadcn-style components on top of Radix UI primitives (`src/components/ui`) |
| HTTP client | Axios (`src/lib/api.ts`) |
| Build tool | Vite 7 (`@lovable.dev/vite-tanstack-config` preset) |
| Deploy target | Cloudflare Workers (via `wrangler`) |
| Package manager | npm / bun (bun.lock present) |

---

## 2. App Architecture

### Routing

TanStack Router's file-based routing maps each file in `src/routes/` to a URL path (e.g. `src/routes/students.tsx` → `/students`, `src/routes/students.$studentId.tsx` → `/students/:studentId`). The router is instantiated in `src/router.tsx`, wired with:

- A shared `QueryClient` passed into route context.
- Scroll restoration.
- Auto-generated route tree (via the TanStack Router Vite plugin).

### Root layout (`src/routes/__root.tsx`)

Every route renders inside a shared shell that provides, top-down:

- `QueryClientProvider` — React Query context.
- `TenantProvider` (`src/lib/tenant.tsx`) — current school/tenant context (branding, subscription).
- `AuthProvider` (`src/lib/auth.tsx`) — session, current user, role, `can()` permission checks.
- `NotificationProvider` (`src/lib/notifications.tsx`) — in-app notification center.
- Two-column layout: collapsible `WorkspaceSidebar` (role-aware navigation) + main content area.
- Header: sidebar toggle, school branding (logo/name/colors), global search (Cmd+K command palette), notification bell, user menu.
- Subscription/suspension banners (present in code, currently disabled/hidden pending product decision).

### Entry points

- `src/start.ts` — app bootstrap.
- `src/server.ts` — SSR handler wrapper for the Cloudflare Workers runtime.
- `vite.config.ts` — built on the `@lovable.dev/vite-tanstack-config` preset, which wires up TanStack Start, the React plugin, Tailwind v4, TS path resolution, and the Cloudflare adapter. Path alias `@/*` → `src/*`.

### Server state (React Query)

- No automatic retries (`retry: false`), errors don't throw by default (`throwOnError: false`) — components are expected to read query `error`/`isError` state explicitly rather than relying on error boundaries.
- Mutations are used throughout for create/update/delete actions, typically followed by `queryClient.invalidateQueries(...)` to refresh lists.

### API client (`src/lib/api.ts`)

- Base URL: `import.meta.env.VITE_API_URL`, defaulting to `http://localhost:8080`. In dev, Vite also proxies `/api/*` to `http://localhost:8080`.
- Axios instance with `Content-Type: application/json`.
- Request interceptor attaches `Authorization: Bearer <token>` from `localStorage.srms_token`.
- Response interceptor clears the stored token on `401 Unauthorized` (forces re-login).
- Responses are unwrapped: the backend's `{ success, message, data, timestamp }` envelope is unwrapped so callers just get `data` (a small `unwrap()` helper strips the wrapper).
- Endpoint helpers are grouped by domain (auth, schools, students, teachers, classes, attendance, assessments, timetable, fees, platform workspace, etc.), generally mirroring the backend's `/api/schools/{schoolId}/{module}` structure.

---

## 3. Authentication & Session

### Login (`src/routes/login.tsx`)

1. User submits email + password.
2. `api.login(email, password)` calls `POST /api/auth/login`, returning `{ token, id, name, email, role, schoolId, initials }`.
3. `completeSignIn(session)` persists the session and redirects into the app.

### Persisted session (localStorage)

| Key | Contents |
|---|---|
| `srms_token` | JWT |
| `srms_user` | Serialized user profile (id, name, email, role, initials) |
| `srms_school_id` | Current tenant/school id |

On app load, `AuthProvider` rehydrates from localStorage and calls `GET /api/auth/me` to validate the token; a `401` clears the stored session and returns the user to `/login`.

### Multi-tenant switching

`SUPER_ADMIN`/system-admin users can switch between school tenants from a dropdown in the sidebar (updates `srms_school_id` and refetches tenant-scoped data). School-scoped roles are locked to their one school.

---

## 4. Roles & Access Control

The frontend recognizes six roles, matching the backend's system roles:

| Role | Description |
|---|---|
| `super_admin` | Platform-wide control across all school tenants |
| `school_admin` | Full operational control of a single school |
| `teacher` | Classroom-focused: attendance, assessments, own students/classes |
| `hod` | Head of Department: department oversight + teacher-level access |
| `finance` | Finance operations: fees, accounting, payroll, procurement, vendors |
| `parent` | Read-mostly access to their own child's records |

### Access control matrix (`src/lib/auth.tsx`)

Each role maps to ~50 module keys with one of three access levels:

- `true` — full read/write access, shown in navigation.
- `"read"` — read-only, shown with an "R" badge in the sidebar.
- `false` — hidden entirely from navigation for that role.

Pages call `can(moduleKey)` from the auth context to decide what to render; the `AccessGuard` component (`src/components/access-guard.tsx`) wraps feature areas to enforce this consistently. The sidebar (`src/components/workspace-sidebar.tsx`) filters its menu tree the same way, so a role never sees a link to a module it can't access.

---

## 5. Navigation Structure

Sidebar menus are role-specific (defined in `src/components/workspace-sidebar.tsx`):

**School Admin** — full menu, grouped as:
- *School Overview*: Dashboard, Students, Admissions, Parents, Teachers, Classes, Subjects, Departments, Curriculum, Timetable, Attendance, Assessments, Examinations, Report Cards
- *School Operations*: Communication, Discipline, Student Welfare, Activities & Clubs, Library, Transport, Health & Clinic, Hostel & Boarding, Inventory, Canteen, Facilities, Visitor Log, Lost & Found, Alumni, Calendar
- *School Finance*: Fee Structure, Bursaries, Fees & Payments, Accounting, Payroll, Procurement, Vendor Management, Human Resources, Staff Development, Duty Roster
- *School Enterprise*: Enterprise Analytics, Security, Compliance, Risk Register, District Management, Reporting, Incident Management, Policy Library, Strategic Plan
- *School Administration*: Users & Roles, Audit Log, Knowledge Base, Help & Support, Settings

**Teacher** — *My Workspace* (Dashboard, Timetable, Attendance, Assessments, Examinations, Report Cards, Calendar), *Students* (Students, Classes, Discipline, Student Welfare, Activities & Clubs, Lost & Found), *Resources* (Communication, Library, Knowledge Base, Help & Support)

**HOD** — *My Department* (Dashboard, Departments, Classes, Timetable, Calendar), *Teaching Records* (Teachers, Attendance, Assessments, Examinations, Report Cards), *Students* (Students, Discipline, Student Welfare), *Resources* (same as Teacher)

**Finance** — *Overview* (Dashboard), *Finance* (Fee Structure, Bursaries, Fees & Payments, Accounting, Payroll, Procurement, Vendor Management, HR, Staff Development, Duty Roster), *Reports* (Enterprise Analytics, Reporting, Risk Register), *Resources* (Knowledge Base, Help & Support)

**Parent** — *My Children* (Home, Attendance, Assessments, Report Card, Fee Balance, Communication, Calendar)

**System/Platform Admin** — *Platform* (Platform Dashboard, System Admin, Platform Ops, Tenant Lifecycle, Tenant Success, Tenant Workbench), *Business* (Contract Center, Partner Management, Approval Center, Support Desk), *Governance* (Platform Config, Platform Audit, Data Governance, Status Center, Developer Console, Settings)

---

## 6. Route Inventory

All routes live in `src/routes/`. Grouped by area (full per-page descriptions are in `docs/USER_MANUAL.md`):

**Core academic**: `index`, `students`, `students.$studentId`, `admissions`, `parents`, `teachers`, `teachers.$staffId`, `classes`, `subjects`, `departments`, `curriculum`, `timetable`, `attendance`, `assessments`, `exams`, `report-card`

**School operations**: `communication`, `discipline`, `student-welfare`, `activities`, `library`, `transport`, `health`, `hostel`, `inventory`, `canteen`, `facilities`, `visitor-log`, `lost-found`, `alumni`, `calendar`

**Finance**: `fee-structure`, `bursaries`, `fees`, `accounting`, `payroll`, `procurement`, `vendor-management`, `billing`

**HR**: `hr`, `staff-development`, `duty-roster`

**Enterprise/Compliance**: `enterprise-analytics`, `security`, `compliance`, `risk-register`, `district-management`, `reporting`, `incident-management`, `policy-library`, `strategic-plan`

**Administration**: `access`, `audit`, `settings`, `help`, `knowledge-base`, `notifications`, `profile`

**Platform (system admin)**: `sys-admin`, `platform-ops`, `tenant-lifecycle`, `tenant-success`, `tenant-workbench`, `onboarding`, `platform-config`, `platform-audit`, `data-governance`, `revenue-ops`, `plan-catalog`, `contract-center`, `partner-management`, `approval-center`, `support-desk`, `status-center`, `developer-console`, `integrations`, `backups`, `user-management`

**Auth/shell**: `login`, `__root`

---

## 7. Configuration & Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the SRMS API | `http://localhost:8080` |

Additional `VITE_*` variables are injected into the client bundle by Vite automatically if defined in a `.env` file.

Dev-server proxy: `vite.config.ts` proxies `/api` → `http://localhost:8080`, so in local dev you generally don't need to set `VITE_API_URL` unless pointing at a remote backend.

---

## 8. Running Locally

Prerequisites: Node.js (see `package.json` engines/devDependencies for version alignment with Vite 7/React 19), and the SRMS API running locally on port 8080 (or `VITE_API_URL` pointed at a reachable instance).

```bash
npm install
npm run dev
```

- Dev server: `http://localhost:5173` (Vite default).
- `postinstall` runs two patch scripts (`scripts/patch-radix-select.cjs`, `scripts/patch-radix-slot.cjs`) that fix known compatibility issues in the pinned Radix UI packages — don't remove these without checking why they exist.

Other scripts:

```bash
npm run build       # production build (client + server bundles)
npm run build:dev   # development-mode build
npm run preview     # preview a production build locally
npm run lint         # eslint
npm run format       # prettier --write .
```

---

## 9. Build & Deployment

```bash
npm run build
```

Produces `dist/client/` (static assets) and `dist/server/` (SSR handler). Deployment target is Cloudflare Workers:

```bash
wrangler deploy
```

- Configured via `wrangler.jsonc`; worker entry point is `src/server.ts`.
- Set `VITE_API_URL` (and any other `VITE_*` vars) appropriately for the target environment before building, since Vite inlines them at build time — they are not runtime-configurable once deployed.
- Update the backend's `cors.allowed-origins` to include the deployed frontend origin (see backend docs §7).

---

## 10. Project Conventions

- **Path alias**: `@/*` → `src/*` (see `tsconfig.json` and `vite.config.ts`).
- **TypeScript**: strict mode enabled, target ES2022.
- **UI components**: prefer composing from `src/components/ui` (shadcn/radix wrappers) over introducing new component libraries.
- **Linting/formatting**: ESLint (`eslint.config.js`) + Prettier (`.prettierrc`) — run `npm run lint` and `npm run format` before committing.
- **Role gating**: any new page/feature must be added to the access-control matrix in `src/lib/auth.tsx` and, if it should appear in navigation, to the relevant role's menu in `src/components/workspace-sidebar.tsx`. A route that exists but isn't in the matrix will effectively be unreachable via `can()`-gated UI (though the URL itself isn't blocked unless the page itself checks `can()`).
