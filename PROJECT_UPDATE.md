# Scribe — Project Update

**Date:** June 2026
**Repo:** `yohananX/Multi-User-exam-project`

---

## What It Is

A **multi-user exam script management platform** where:
- **Teachers** upload scanned exam scripts, message admins, track grading pipeline
- **School Admins** manage teachers/classes/subjects, run OCR/DOCX/imposition pipeline
- **Super Admins** manage all users (any role), classes, and subjects from one panel
- Backend processes scripts through OCR (Gemini AI) → DOCX generation → PDF imposition

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + React Router v7 |
| Backend | FastAPI (Python 3.14) on port 8000 |
| Auth | Supabase Auth (email/password, JWT) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`uploads`, `generated` buckets) |
| AI/OCR | Google Gemini API |
| Document Gen | `python-docx` (DOCX), `reportlab` (PDF imposition) |
| Worker | Standalone Python script polling for OCR pipeline work |

---

## Roles (exactly 3)

`super_admin` → `school_admin` → `teacher`

No `admin` role. All route protection checks `user.role === 'teacher'` to block teachers from admin pages; both `super_admin` and `school_admin` pass through.

---

## What Exists — By Feature

### 1. Auth & Onboarding
- Supabase Auth email/password login
- Onboarding flow: first-time teacher picks their teaching assignments (class + subject)
- AuthContext resolves user profile from DB (by auth_id, then by email fallback, then auth metadata)
- Password change in Settings

### 2. Teacher Dashboard (`/`)
- Stats cards (subjects, pending/completed images, unread messages)
- Recent uploads activity feed
- Quick action buttons

### 3. Teacher Upload (`/upload`)
- Drag-and-drop file upload
- Subject/class/exam-type/term/session selectors
- Upload progress tracking
- Success state with navigation

### 4. Teacher My Uploads (`/uploads`)
- Search, filter by status/subject
- Table view of uploaded scripts with status badges

### 5. Messages (`/messages`)
- Role-aware conversation list (teachers see admins only; admins see all teachers)
- Optimistic send — message appears instantly, replaced by real DB record
- Real-time updates via Supabase Realtime channels
- SVG read receipts (double checkmark for read, single for unread)
- Date separators in thread
- Auto-grow textarea, Cmd/Ctrl+Enter to send
- **4-tab Reference Picker** (paperclip icon):
  - **Subjects** tab — teachers see their assigned subjects; admins see all subjects
  - **Uploads** tab — teachers see their uploads; admins see all recent uploads
  - **Teachers** tab — list all teachers with email
  - **Classes** tab — list all classes with section
- Selected ref appears as a chip above the compose bar
- Sent refs appear in message bubbles as clickable links:
  - Subject → navigates to subject detail page
  - Image → navigates to the image's subject page
  - Teacher → navigates to `/admin/teachers`
  - Class → navigates to `/admin/classes` (admin) or `/uploads` (teacher)
- Click-outside to dismiss the picker

### 6. Settings (`/settings`)
- Profile section (edit name/email with Supabase auth sync)
- Change Password (current/new/confirm, strength bar, match indicator)
- Teaching Assignments (view/remove, collapse animation)
- Danger Zone (teachers only, red border, sign out)

### 7. Admin Dashboard (`/`)
- Greeting with time-of-day awareness
- 4 stat cards: Subjects, Pending Images, In Review, Teachers
- **Pipeline tab bar** with 4 tabs + count badges:
  - **Needs OCR** → "Run OCR" button → imagesApi.ocr()
  - **Needs DOCX** → "Build DOCX" button → imagesApi.buildDocx()
  - **Needs Impose** → "Run Impose" button (default settings: 3×2, 5mm margin, Auto split)
  - **Completed** → "View" button (navigate to subject) + "Download" button (download imposed PDF)
- **Optimistic state updates** — clicking an action moves the item to the next tab immediately (no full re-fetch)
- **Inline error display** — on failure, item rolls back to original tab + red error message for 3s
- Per-row loading spinner on the action button
- Empty states per tab (CheckCircle icon + message)
- **Quick Actions** sidebar: Teachers, Classes, Structure
- **Recent Uploads** feed with navigation
- Skeleton loading for stat cards and pipeline list

### 8. Admin Teachers (`/admin/teachers`)
- List all teachers with search
- Click teacher → right panel shows their assignments
- Create teacher modal with password generation + copy
- Delete teacher inline with confirmation
- Add assignment: select class → on-demand subjects → batch select
- Already-assigned subjects greyed out

### 9. Admin Classes (`/admin/classes`)
- Two-column layout: classes left, subjects right
- Create class with name + optional section, duplicate check
- Delete class with subject count warning
- Click class → load its subjects in right panel
- Create/delete subject inline
- Subject status dots + navigate to subject detail
- `CLASS_SORT_ORDER`: Reception, Primary 1-6, JSS 1-3, SS 1-3

### 10. Admin Structure View (`/admin/structure`)
- Read-only tree of all classes with their subjects
- Status dots and badges per subject
- Click subject → navigate to subject detail
- Inline "Add Subject" per class
- Status legend: Active (green), Pending (yellow), Completed (accent), Rejected (red)

### 11. Admin Subject View (`/admin/subjects/:id`)
- Pipeline progress bar (OCR → DOCX → Impose)
- OCR section: Run OCR + editable textarea + Save
- DOCX section: Build + Download
- Impose section: Run Impose with configurable settings + Download
- Image gallery: thumbnails, click-to-view lightbox, inline delete, Add Image upload

### 12. Super Admin Panel (`/admin/super`)
- **Users section:**
  - Search/filter users by name or email
  - Add User inline form: full name, email, role selector (super_admin/school_admin/teacher), auto-generated password with regenerate
  - User table with checkboxes, role badges (purple/blue/green), per-row delete
  - Bulk delete with selection count
  - Skeleton loading
- **Classes section:**
  - Add Class inline form (name + optional section)
  - Per-class delete (hover-reveal)
  - Expand/collapse to view subjects within a class
  - Per-subject delete
  - Inline Add Subject input per class
  - Subject status dots
- Access-gated to `super_admin` role only (others see "Super Admin access only" message)
- Nav item "Management" (shield icon) only visible in sidebar for super_admin role

### 13. Backend API (FastAPI)
- 9 router modules: `auth`, `users`, `schools`, `classes`, `subjects`, `assignments`, `images`, `dashboard`, `admin`
- Image processing pipeline: OCR (Gemini) → DOCX build → PDF imposition
- Supabase REST API wrapper (`supabase_db.py`)
- File upload/download via Supabase Storage signed URLs

### 14. Worker (`worker/main.py`)
- Standalone Python script, polls Supabase for `ocr_pending` subjects
- Full pipeline: download images → OCR via Gemini → save OCR text → build DOCX → upload DOCX → impose to PDF → upload PDF → generate previews → mark completed
- `--watch` mode with configurable poll interval (default 60s)

---

## SQL Migrations (7 files — none have been run yet)

**Must run `run_all.sql` first** in Supabase SQL Editor, then the others as needed:

| File | Purpose | Required? |
|---|---|---|
| `run_all.sql` | Fix RLS recursion, add auth_id to teacher_assignments, create messages table, auto-profile trigger | **YES — critical** |
| `supabase_messages.sql` | Create messages table (standalone, duplicative if run_all.sql ran) | Skip if run_all.sql ran |
| `messages_teacher_ref.sql` | Add `teacher_ref_id` column to messages table | YES — for teacher references |
| `notifications_migration.sql` | Create notifications table + 5 triggers | Optional |
| `super_admin_delete.sql` | DELETE policy + SECURITY DEFINER RPC for user deletion | YES — for Super Admin delete |
| `supabase_setup.sql` | Original schema setup (superseded by run_all.sql) | Only for new projects |
| `fix_rls.sql` | Fix recursive RLS (superseded by run_all.sql) | Skip if run_all.sql ran |

---

## Git History (9 commits)

```
45f66f4  First commit (initial project scaffold)
4c9dee5  Remove hard-coded credentials, add registration flow
ade8aa2  Migrate to Supabase Storage for all files
a72fb03  Image preview endpoints + frontend thumbnails
702d7c1  Full Supabase architecture (auth, CRUD, storage)
1d42ca9  Complete UI redesign (shadcn/ui, dark theme, layouts)
5bf361f  Fix auth flow: manual profile, email fallback, error messages
18964f3  Fix RLS recursion: fallback to auth metadata
bbd56af  Super Admin, 4-tab messages, optimistic pipeline, Settings, RLS SQL
```

---

## What's Pending

1. **Run all SQL migrations** in Supabase SQL Editor (especially `run_all.sql`)
2. **Push to GitHub** — remote is set to HTTPS, needs a personal access token
3. **Deploy** — frontend to Vercel/Netlify, backend to Railway/Render, worker as cron job
4. **Chunk size warning** (717 KB JS bundle) — consider React.lazy() for admin pages
5. **Pre-existing TS errors** in 3 files (Teachers.tsx, MessagesPage.tsx, SettingsPage.tsx) — unrelated to our changes

---

## How to Run

```bash
# Terminal 1 — Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Worker (optional, for OCR pipeline)
cd worker && python main.py --watch
```

Supabase project ref: `daehslgkvympnsudfdaf`
Dev accounts: `admin` / `admin123`, `teacher1` / `teacher123`
