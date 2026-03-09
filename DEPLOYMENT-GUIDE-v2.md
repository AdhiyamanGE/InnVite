# InnVite v2 — Deployment Guide

## What's New in v2
Multi-user authentication · Permission-based access requests · Real-time collaborative editing
· Edit lock / conflict prevention · Audit trail · Activity timeline

---

## Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon public key** (Settings → API)

---

## Step 2 — Run the Database Schema

1. Supabase Dashboard → **SQL Editor** → New Query
2. Paste the **entire contents** of `supabase-schema-v2.sql`
3. Click **Run**

> ⚠️ Use `supabase-schema-v2.sql`, NOT the old `supabase-schema.sql`

**What the schema creates:**
- `profiles` — user accounts (auto-created on registration via DB trigger)
- `guests`, `rooms`, `pairs`, `app_state` — same as v1, now user-scoped with `user_id`
- `access_requests` — pending/accepted/rejected access requests between users
- `permissions` — granted access records (can_view + can_edit, additive)
- `edit_locks` — pessimistic 45-second row locks for concurrency control
- `audit_logs` — append-only event log for all actions

---

## Step 3 — Configure Supabase Auth

1. Supabase Dashboard → **Authentication → Settings**
2. **Disable** "Enable email confirmations" (recommended for private app)
   - This lets users log in immediately after registering without verifying email
3. Set **Site URL** to your Netlify URL (e.g. `https://your-app.netlify.app`)
4. Under **Email Auth** → make sure it's enabled

---

## Step 4 — Deploy to Netlify

### Option A: Drag-and-drop (quickest)
```bash
npm install
npm run build     # creates dist/ folder
```
Then drag the `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)

### Option B: Git-connected (recommended for updates)
1. Push the project to a GitHub repo
2. Netlify → Add New Site → Import from Git
3. Build settings are in `netlify.toml` — no manual configuration needed

---

## Step 5 — Set Environment Variables

Netlify Dashboard → Site → **Environment Variables** → Add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (the anon/public key) |

After adding, **trigger a redeploy**: Deploys → Trigger Deploy.

---

## Local Development

```bash
cd innvite
npm install
cp .env.example .env   # then edit with your real Supabase keys
npm run dev            # → http://localhost:5173
```

---

## How the System Works

### Authentication
- Email + password via Supabase Auth
- A `profiles` row is auto-created via DB trigger on registration
- Session persists in browser via Supabase's built-in session management

### Permission Request Flow
```
User1 → sends access request (view / edit / both) → User2
User2 → accepts → permissions row upserted (additive)
User1 → sees User2's data button in header
```
**Incremental:** If User1 has View and sends an Edit request, accepting adds Edit while preserving View.

### Edit Lock Mechanism (Concurrency Control)
1. **Pessimistic lock** — stored in `edit_locks` table with 45-second TTL
2. Before editing a record, the app writes a lock row (`record_type`, `record_id`, `locked_by`, `expires_at`)
3. A **heartbeat** refreshes `expires_at` every 20 seconds while the edit form is open
4. If another user tries to edit the same record, they see: *"Being edited by [Name]"*
5. **Owner priority** — the data owner's lock always overrides any shared-user lock
6. **Optimistic fallback** — every row has a `version` integer; updates use `.eq('version', expectedVersion)` so a stale write silently fails rather than overwriting
7. Locks are released on save, cancel, or navigation away

### Change Tracking
Every `guests` and `rooms` row has:
- `last_edited_by` (UUID → profiles)
- `last_edited_at` (timestamp)
- `version` (integer, incremented on every update)

In the UI, rows edited by a shared user are highlighted in blue with an **"✏️ edited by [name]"** badge.

### Audit Log
- Append-only table (`audit_logs`) — no UPDATE or DELETE RLS policies
- Every significant action is fire-and-forget logged (never blocks main operation)
- Logged events: registration, login, logout, access requests, permission grants/revokes, all CRUD on guests/rooms/pairs, allocation runs, import/export
- Activity Timeline tab shows a filterable, searchable chronological feed

### RLS (Row-Level Security)
All tables have RLS enabled. Key rules:
- Owners have full control over their own rows
- Grantees with `can_view=true` can SELECT from owner's data
- Grantees with `can_edit=true` can INSERT/UPDATE/DELETE owner's data
- Edit lock: all authenticated users can read locks; only lock holder or data owner can release
- Audit logs: users can insert their own logs and read logs they're involved in

---

## File Map — What Changed from v1

| File | Status | Notes |
|---|---|---|
| `supabase-schema-v2.sql` | 🆕 NEW | Replace v1 schema entirely |
| `src/lib/auth.js` | 🆕 NEW | Register, login, logout, profile fetch |
| `src/lib/audit.js` | 🆕 NEW | Fire-and-forget audit logger |
| `src/lib/useAuth.js` | 🆕 NEW | Session state hook |
| `src/lib/usePermissions.js` | 🆕 NEW | Full permission lifecycle hook |
| `src/lib/useLocks.js` | 🆕 NEW | Pessimistic lock + heartbeat hook |
| `src/lib/db.js` | ✏️ MODIFIED | User-scoped, version-tracked, audit-logged |
| `src/lib/useAppData.js` | ✏️ MODIFIED | Accepts `userId`/`actorId` params |
| `src/App.jsx` | ✏️ MODIFIED | Auth gate, 6 tabs, shared data navigation |
| `src/pages/LoginPage.jsx` | 🆕 NEW | Register + login form |
| `src/pages/SharedDataView.jsx` | 🆕 NEW | Shared data panel with lock indicators |
| `src/tabs/AccessTab.jsx` | 🆕 NEW | Request/grant/revoke access UI |
| `src/tabs/AuditTab.jsx` | 🆕 NEW | Activity timeline with filters |
| `src/tabs/GuestsTab.jsx` | ✏️ MODIFIED | Lock badges, change tracking highlights, readOnly |
| `src/tabs/RoomsTab.jsx` | ✏️ MODIFIED | Lock badges, change tracking highlights, readOnly |
| `src/tabs/PairsTab.jsx` | ✏️ MODIFIED | readOnly prop support |
| `src/tabs/AllocateTab.jsx` | ✏️ MODIFIED | readOnly prop support |
| `src/components/UI.jsx` | ✅ UNCHANGED | |
| `src/lib/allocate.js` | ✅ UNCHANGED | Pure algorithm untouched |
| `src/lib/constants.js` | ✅ UNCHANGED | |
| `src/lib/supabase.js` | ✅ UNCHANGED | |

---

## Security Notes

- The Supabase `anon` key is safe to expose in the browser — it can only do what RLS allows
- All data isolation is enforced at the **database level** via RLS, not just the app
- No user can read or write another user's data without an explicit accepted permission
- Audit logs cannot be modified or deleted by any user (insert-only RLS)
