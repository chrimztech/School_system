# SRMS User Manual

**School Records Management System — End-User Guide**

This manual explains how to use the SRMS web application day-to-day. It is written for school staff — administrators, teachers, heads of department, finance officers — and parents. If you're looking for installation/deployment instructions or the API reference, see `docs/TECHNICAL_DOCUMENTATION.md` in this repo (frontend) and in the `School_system-api` repo (backend).

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Understanding Roles](#2-understanding-roles)
3. [The Workspace: Navigation, Search & Notifications](#3-the-workspace-navigation-search--notifications)
4. [School Overview Features](#4-school-overview-features)
5. [School Operations Features](#5-school-operations-features)
6. [Finance Features](#6-finance-features)
7. [Human Resources Features](#7-human-resources-features)
8. [Enterprise, Compliance & Governance Features](#8-enterprise-compliance--governance-features)
9. [Administration Features](#9-administration-features)
10. [Teacher Guide](#10-teacher-guide)
11. [Head of Department (HOD) Guide](#11-head-of-department-hod-guide)
12. [Finance Officer Guide](#12-finance-officer-guide)
13. [Parent Portal Guide](#13-parent-portal-guide)
14. [Platform Administration (System/Super Admin)](#14-platform-administration-systemsuper-admin)
15. [Frequently Asked Questions](#15-frequently-asked-questions)

---

## 1. Getting Started

### Logging in

1. Go to your school's SRMS web address and open the **Login** page.
2. Enter the email address and password given to you by your school administrator.
3. Click **Sign In**.
4. You'll land on your **Dashboard**, which looks different depending on your role (see [Section 2](#2-understanding-roles)).

Your session stays active for 24 hours. After that, you'll be asked to log in again — this is normal and protects your account.

### Changing your password

1. Click your name/avatar in the top-right corner.
2. Open **My Profile** (also reachable via the **Profile** page).
3. Use the **Change Password** option — you'll need to enter your current password before setting a new one.

### If you're a new staff member

Your account is created for you by a School Administrator (via **Users & Roles**) or, for teachers/teaching staff, automatically when your profile is added under **Teachers**. You'll receive your login email and a temporary password from the school office — change it on first login.

---

## 2. Understanding Roles

SRMS tailors what you see based on your role. There are six roles:

| Role | Who this is | What they can do |
|---|---|---|
| **School Admin** | Head teacher, deputy, bursar-in-chief, IT admin | Full access to every school module: students, staff, academics, finance, operations, compliance, settings |
| **Teacher** | Classroom/subject teachers | Attendance, assessments, exams, report cards, timetable, their students/classes, library, communication |
| **HOD (Head of Department)** | Department heads | Everything a teacher has, plus oversight of their department's teachers, classes and timetable |
| **Finance** | Bursar, accounts staff | Fee structure, fees & payments, accounting, payroll, procurement, vendor management, HR, staff development, duty roster |
| **Parent** | Guardians of enrolled students | Read access to their own child's attendance, marks, report card, fee balance, plus calendar and communication |
| **Super Admin / System Admin** | Platform operators (usually the SRMS provider, not school staff) | Manage all schools on the platform, subscriptions, platform-wide settings — see [Section 14](#14-platform-administration-systemsuper-admin) |

The rest of this manual is organized primarily around what a **School Admin** sees (since they have access to everything), with dedicated shorter guides for **Teacher**, **HOD**, **Finance**, and **Parent** roles afterward, covering the same features from their narrower point of view.

---

## 3. The Workspace: Navigation, Search & Notifications

- **Sidebar** (left): your main menu, grouped into sections (e.g. School Overview, School Operations, School Finance...). Click the collapse icon to shrink it to icons-only if you want more screen space.
- **Header** (top): shows your school's name/logo/branding, a global search bar, the notification bell, and your user menu.
- **Global search (Cmd+K / Ctrl+K)**: opens a command palette to quickly jump to a page or find a student/teacher/record by name without navigating the sidebar.
- **Notification bell**: shows in-app notifications (e.g. new discipline case, leave request awaiting approval, low library stock). Click to view all in the **Notifications** page; mark as read/unread there.
- **Help & Support**: available from the sidebar — includes FAQs and a support ticket form if you're stuck.
- **Knowledge Base**: searchable how-to articles, available to every role.

---

## 4. School Overview Features

### Dashboard
Landing page showing at-a-glance stats: enrolled students, teaching staff, active classes, today's attendance rate, and fee collection summary. Use this to spot issues quickly (e.g. unusually low attendance).

### Students
The learner register.
- **Add a student**: click **New Student**, and complete the 3-step wizard: (1) personal details — name, DOB, gender, admission number; (2) guardian details — name, phone, email (this can auto-create a parent login); (3) confirm and save.
- **Edit/View**: click a student row to open their profile — edit personal, contact and medical details, and see their class enrolment.
- **Delete/Deactivate**: removes a student from the active register (used for withdrawals/transfers).
- **Filter & search**: filter by status (active/inactive) or grade, search by name or admission number.
- **Bulk import**: use the CSV import option to add many students at once (useful at start of year).

### Admissions
Tracks prospective students from enquiry through to enrolment.
- Statuses: enquiry → application → enrolled / rejected.
- **Bulk import** applicants from CSV.
- **Filter** by status or application date; **export** the register for reporting.
- Accepting an admission automatically creates the corresponding student record.

### Parents
Directory of guardians linked to students — view contact details, linked children, and communication history. Parent portal logins are usually created automatically when you add guardian details on a student's profile.

### Teachers
Staff directory for teaching staff.
- **Add a teacher**: capture qualifications, department, teaching experience, salary, and banking details. This auto-creates their login account.
- **Edit/View**: click a teacher to see/edit their profile and manage which classes/subjects they teach.
- **Bulk import** and **filter by status/department** are available, same as Students.
- HODs see this filtered to teachers relevant to their department/assignments.

### Classes
Manage forms/streams (e.g. "Form 1A", "Grade 5B").
- **Create a class**: give it a name/grade/section, set capacity, assign a class teacher.
- **Enrol/unenrol students** into a class from the class detail view.
- **Assign teachers**: link teachers to a class for a given subject.

### Subjects
The list of subjects taught (e.g. Mathematics, English).
- **Add/edit subjects**, assign teachers, and define grading scales used in report cards.

### Departments
Groups subjects/teachers under an academic department (e.g. Sciences, Languages).
- **Assign a HOD** to a department; view department-wide statistics.

### Curriculum
Defines learning outcomes/competencies/standards per subject and grade, including alignment to the Zambian curriculum and ECZ syllabi where applicable. Useful for tracking curriculum coverage across the year.

### Timetable
Builds the period-by-period (secondary) or daily (primary) class schedule.
- **Assign** teachers/subjects to time slots; the system flags clashes.
- **Publish** the timetable once finalized so teachers/students can view it.
- **Download** as PDF for printing/posting.

### Attendance
Daily class registers.
- **Mark attendance**: present / absent / late, per class, per day (or per period for secondary schools).
- **Offline mode**: attendance can be recorded even with poor connectivity and synced later — useful for rural/low-connectivity sites.
- **Bulk upload** is available for catching up on missed days.
- Submitting attendance can trigger **automatic SMS notifications** to parents of absent students (if SMS is enabled for your school).
- **Summary view**: attendance rate and trend charts, filterable by date/class.

### Assessments
Continuous assessment marks (tests, quizzes, projects, coursework).
- **Create an assessment** (name, subject, max score, weighting).
- **Enter marks** per student, or use the bulk-entry view for a whole class at once.
- View results by student, subject, or class; export the mark register.

### Examinations
Formal exam scheduling and mark entry — supports both internal school exams and external ECZ (Examination Council of Zambia) exams.
- **Schedule** an exam (date, time, duration, instructions, invigilators).
- **Enter and lock marks** once an exam series is complete, to prevent accidental changes.

### Report Cards
Generates learner progress reports combining attendance, assessments and exam results.
- Add **class-teacher commentary**.
- Configure **grading/mark conversion** and the school's **term/reporting periods**.
- **Print or email** report cards directly to guardians.

---

## 5. School Operations Features

### Communication
Send SMS/email broadcasts to students, parents, or staff.
- Use **message templates** for common announcements (fee reminders, event notices).
- **Schedule** messages for later delivery.
- **Segment** recipients by class, department, or role.
- Track delivery status; supports two-way SMS replies where enabled.

### Discipline
Log and manage behavioral incidents.
- Record an incident: student, date, category (truancy, violence, insubordination, etc.), description, action taken.
- Track **repeat offenders** and **notify guardians** automatically.
- Mark a case **resolved** once addressed.

### Student Welfare
Pastoral care and counselling records.
- Log counselling sessions, home visits, and welfare notes.
- **Flag at-risk students** and record intervention plans or referrals to outside support services.

### Activities & Clubs
Manage clubs, societies, and sports teams.
- Track membership, schedule events, record attendance, and log achievements/awards.

### Library
Book cataloging and lending.
- **Add books** to the catalog (title, author, ISBN, quantity).
- **Check out / return** books to students, with due dates and automatic overdue reminders.
- View borrowing history and popular-book/stock reports; library fines are tracked if enabled.

### Transport
School transport management.
- Define **routes** and assign **vehicles/drivers**.
- **Enrol students** on a route with their pickup location.
- Track daily roll and route costs; transport fees integrate with the Fees module.

### Health & Clinic
Campus health records.
- Log health checks, vaccination records, medication logs, and emergency health alerts.
- Manage the campus clinic and staff health records.

### Hostel & Boarding
Boarding house management.
- **Allocate rooms/beds** to students; track occupancy.
- Manage **leave requests** (student sign-out) and **sign-in/out** logging.
- Boarding fees integrate with the Fees module.

### Inventory
Track school stock — stationery, lab equipment, consumables.
- Set **reorder points**; record stock movements (received/issued).
- View asset valuation and depreciation where tracked.

### Canteen
Meal planning and sales.
- Manage the **menu**, record **orders/sales**, and track student meal-plan subscriptions.
- View cost analysis and nutritional tracking if configured.

### Facilities
Maintenance and asset management for buildings/spaces.
- Log a **maintenance/work order request**, track its progress, and **close** it once resolved.
- Review maintenance schedules and space-utilization reports.

### Visitor Log
Front-desk visitor management.
- **Check in** a visitor (name, purpose, host, photo if available); **check out** when they leave.
- Bulk import for events; view visit history.

### Lost & Found
Track lost/found items on campus.
- **Report** an item found or lost; **claim** an item once the owner is verified.
- Unclaimed items can be tracked toward a disposal process.

### Alumni
Maintain records of graduated students.
- Track contact details, alumni events, donations, and mentorship program participation.

### Calendar
The shared school calendar — holidays, term dates, exams, events.
- Color-coded by category; supports event RSVP where used.
- Visible (in filtered form) to all roles, including parents.

---

## 6. Finance Features

*(Full detail also in the [Finance Officer Guide](#12-finance-officer-guide).)*

### Fee Structure
Define what students are charged.
- Set up **fee categories** (tuition, activity, transport, meals) and amounts **per class/term**.
- Configure **discounts/exemptions/waivers** (merit- or need-based) and multi-currency support if your school uses it.

### Bursaries
Scholarship and bursary fund management.
- Track **applicants**, **award** allocations, and **disburse payments**.
- Track donor funding and report on program impact.

### Fees & Payments
Day-to-day fee collection.
- View each student's **fee account** and **balance**.
- **Record a payment** (cash, mobile money, bank transfer) against a student's account.
- Generate **invoices** and **arrears reports**; send payment reminders (via Communication).
- Transport/hostel/canteen charges appear here if those modules are enabled.

### Accounting
General ledger for the school.
- **Journal entries** with a chart of accounts; **post** entries to finalize them.
- Record **expenses**; run monthly reconciliation.
- Produce financial reports (P&L, balance sheet) and maintain an audit trail.

### Payroll
Staff salary processing.
- Create a **payroll run** for a month; the system generates **payslips** per staff member (gross, deductions, net).
- **Process/finalize** a run once reviewed — this locks the payslips for that period.
- Supports deductions (tax, insurance, loans) and bank transfer details.

### Procurement
Purchasing workflow.
- Raise a **purchase requisition**, collect supplier quotes, and generate a **purchase order**.
- **Approve** requests through the workflow; match against goods receipt and invoices before payment.

### Vendor Management
Supplier database.
- Track vendor details, contract terms, and payment terms.
- Record performance ratings and manage a blacklist if a vendor underperforms.

### Billing
Your school's own SRMS subscription (not student fees — this is the platform subscription).
- View your school's plan (core/growth/advanced/enterprise), billing cycle, invoices and payment history.
- View learner/SMS quota usage against your plan.

---

## 7. Human Resources Features

### HR
Central staff records.
- Maintain qualifications, experience, certifications, and contract details for all staff (not just teachers).
- Manage **leave requests**: staff submit, an admin/HOD **approves or rejects**.

### Staff Development
Professional growth tracking.
- Log **training records** and course enrolments/completions.
- Record **appraisals** and **classroom observations**.
- Maintain individual **Personal/Professional Development Plans (PDPs)**.

### Duty Roster
Weekly staff duty assignments (e.g. morning gate duty, evening duty, night watch).
- **Publish** the roster; handle substitutions when someone is unavailable.

---

## 8. Enterprise, Compliance & Governance Features

### Enterprise Analytics
Dashboards for enrollment trends, staff composition, and financial health. Build custom charts and export to Excel for board/management reporting.

### Security
Access logs, suspicious-activity alerts, and security policy management for your school's account (credential audits, session timeout settings).

### Compliance
Regulatory checklist — Ministry of Education requirements, TPIN/registration status, audit readiness — with links into the Policy Library for supporting documentation.

### Risk Register
Log operational, financial, or reputational risks with a rating, mitigation plan, and an owner. Review on a schedule; link incidents (from Incident Management) to risks where relevant.

### District Management
For schools that are part of a multi-school district/group: compare schools, coordinate compliance, and allocate shared resources. (Only visible if your school participates in a district grouping.)

### Reporting
Build custom reports and schedule them for automatic email delivery (daily/weekly/monthly). Includes pre-built templates for common statutory (MOE) reports.

### Incident Management
Log accidents, thefts, or policy-violation incidents separate from student discipline — track investigation status and resolution, and conduct post-incident reviews.

### Policy Library
Read-only reference documentation: HR policies, disciplinary procedures, health & safety, financial policies — version-tracked with a "last updated" date.

### Strategic Plan
The school's mission/vision/goals and multi-year roadmap.
- Track annual objectives and link them to budget where relevant.
- Record progress and periodic strategic reviews.

---

## 9. Administration Features

### Users & Roles (Access)
Manage who can log in and what they can do.
- **Create a user account**, assign a system role (School Admin/Teacher/HOD/Finance/Parent), or define a **custom role** with specific module permissions for finer-grained control.
- **Reset passwords** and **activate/deactivate** accounts.

### Audit Log
A read-only trail of system events — logins, data changes, exports — with timestamps and the user responsible. Use this to investigate "who changed this record?"-type questions.

### Settings
School-wide configuration:
- **Branding**: name, motto, logo, favicon, primary/secondary/accent colors.
- **Academic setup**: school type (nursery/primary/secondary/combined/full), levels, campuses, current term/year, curriculum.
- **Currency** (defaults to ZMW; multi-currency can be enabled).
- **Feature toggles**: turn on/off offline attendance mode, SMS, USSD, ECZ alignment, library, transport, canteen, multi-currency — only enabled features appear in the sidebar for your school.

### Help & Support / Knowledge Base
Search FAQs, browse how-to articles, or submit a support ticket if you're stuck. Contact details for platform support are listed here too.

### Notifications
Central feed of in-app alerts (approvals pending, low stock, new messages, etc.) with read/unread tracking and preferences.

### My Profile
View and edit your own name, email, phone number, and photo; change your password from here as well.

---

## 10. Teacher Guide

As a **Teacher**, your sidebar is split into three groups:

**My Workspace**
- **Dashboard** — your day at a glance (today's classes, pending marking).
- **Timetable** — your personal teaching schedule.
- **Attendance** — mark daily/period attendance for your classes.
- **Assessments** — enter continuous assessment marks for subjects you teach.
- **Examinations** — view exam schedules and enter marks for exams you're assigned to.
- **Report Cards** — add your commentary and review report cards for your students.
- **Calendar** — school-wide events and your own teaching schedule.

**Students**
- **Students** — read access to student profiles for your classes.
- **Classes** — the classes/streams you teach.
- **Discipline** — log a discipline incident for a student.
- **Student Welfare** — log pastoral-care notes/concerns.
- **Activities & Clubs** — manage any clubs/teams you run.
- **Lost & Found** — report or help resolve lost items.

**Resources**
- **Communication** — message parents/students in your classes.
- **Library** — check book availability, borrow/return on behalf of students if needed.
- **Knowledge Base** / **Help & Support** — self-serve help.

Teachers do not see Finance, HR, or Platform Administration sections — those are hidden entirely from your sidebar.

---

## 11. Head of Department (HOD) Guide

HODs get everything a Teacher has, plus department oversight, organized as:

**My Department**
- **Dashboard**, **Departments** (your department's detail/settings), **Classes** and **Timetable** across your department, **Calendar**.

**Teaching Records**
- **Teachers** — the staff in your department (view/manage their assignments).
- **Attendance**, **Assessments**, **Examinations**, **Report Cards** — department-wide visibility, not just your own classes.

**Students**
- **Students**, **Discipline**, **Student Welfare** for students taught within your department.

**Resources**
- Same as Teacher: Communication, Library, Knowledge Base, Help & Support.

Use the Departments page to see department-wide statistics and to approve/coordinate teacher assignments and class allocations within your subject area.

---

## 12. Finance Officer Guide

As **Finance**, your sidebar is:

**Overview** — Dashboard (finance-relevant KPIs: collections, arrears, payroll status).

**Finance**
- **Fee Structure** — set up what's charged.
- **Bursaries** — manage scholarship funds and awards.
- **Fees & Payments** — day-to-day collection and student balances.
- **Accounting** — general ledger, journal entries, expenses.
- **Payroll** — run monthly payroll and generate payslips.
- **Procurement** — requisitions, purchase orders, approvals.
- **Vendor Management** — supplier records.
- **HR** — staff records (needed for payroll accuracy).
- **Staff Development** — training cost tracking where linked to budget.
- **Duty Roster** — visibility for coordinating staff schedules.

**Reports** — Enterprise Analytics, Reporting, Risk Register (financial risk visibility).

**Resources** — Knowledge Base, Help & Support.

**Typical month-end workflow**: reconcile Fees & Payments → post outstanding Accounting journal entries → run and process the Payroll run → review the Enterprise Analytics finance dashboard → file/export statutory reports from Reporting.

---

## 13. Parent Portal Guide

Parents get the simplest view — **My Children**:

- **Home** — a summary of your child/children (or switch between children if you have more than one enrolled).
- **Attendance** — your child's attendance history.
- **Assessments** — continuous assessment marks as they're entered.
- **Report Card** — view/download your child's report card once published by the school.
- **Fee Balance** — your child's current fee balance and payment history (read-only; make payments through your school's designated payment channel — the portal shows balance, not a payment gateway, unless your school has enabled online payments).
- **Communication** — messages from the school, and replies where two-way messaging is enabled.
- **Calendar** — school events, holidays, and term dates.

Parent accounts are typically created automatically when your contact details are added to your child's student profile by the school office — you'll receive a login email. If you have more than one child at the school, all linked children should appear once you log in with the same guardian email.

---

## 14. Platform Administration (System/Super Admin)

This section is for the platform operator (typically the SRMS provider's own staff), not individual school staff. It's included here for completeness.

**Platform**
- **Platform Dashboard** — cross-tenant overview: total schools, learners, staff, subscription status, revenue.
- **System Admin** — create/edit/deactivate school tenants; set subscription plan and billing cycle; enable/disable features per school; monitor quota usage.
- **Platform Ops** — infrastructure health, database performance, backup status.
- **Tenant Lifecycle** — onboard new schools (setup wizard) and offboard schools (data export/account closure).
- **Tenant Success** — account management, adoption tracking, success check-ins.
- **Tenant Workbench** — diagnostic tools and bulk data operations for a specific tenant.

**Business**
- **Contract Center**, **Partner Management**, **Approval Center**, **Support Desk** — commercial/contract administration and school support ticket handling.

**Governance**
- **Platform Config** — global feature flags, quota defaults, email/SMS templates, payment gateway integration.
- **Platform Audit** — cross-tenant audit log.
- **Data Governance** — retention policies, data export requests, privacy compliance.
- **Status Center**, **Developer Console**, **Settings** — status page publishing, API key/webhook management, platform-level settings.

Onboarding a new school (via **Onboarding**/**Tenant Lifecycle**) walks through: basic info → branding → academic structure (levels, terms, curriculum) → creating the school's first admin user → feature selection. Once complete, that school's own School Admin takes over day-to-day use as described in Sections 4–9.

---

## 15. Frequently Asked Questions

**I can't see a menu item I expect.**
Your role or your school's enabled features may not include that module. Ask your School Admin to check **Users & Roles** (your permissions) or **Settings** (feature toggles for the school).

**I forgot my password.**
Ask your School Admin to reset it via **Users & Roles**; you'll get a new temporary password to change on next login. There is currently no self-service "forgot password" email flow — resets go through your admin.

**My session logged me out unexpectedly.**
Sessions expire after 24 hours automatically for security. Just log in again.

**Attendance/marks I entered don't show for a student.**
Check that the student is enrolled in the class you marked (via **Classes → enrolments**), and that you're looking at the correct term/date.

**A parent says they can't see their child.**
Confirm the guardian email on the student's profile matches exactly what the parent is using to log in, and that a parent account was actually created (check **Users & Roles**).

**Where do I report a bug or ask for a new feature?**
Use **Help & Support** to submit a ticket, or check the **Knowledge Base** first in case it's already answered there.
