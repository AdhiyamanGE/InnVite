# 🏨 InnVite — Netlify + Supabase

Production-quality deployment of the InnVite with:
- **Supabase** — PostgreSQL database, real-time sync across devices, Row-Level Security
- **Netlify** — CDN hosting, automatic deploys from Git, environment variable management
- **React 18 + Vite** — fast builds, lazy-loaded test runner, mobile-optimised UI

---

## Architecture Overview

```
Browser (React 18 + Vite)
    │
    ├── src/App.jsx              ← Root component, dialog management, tab routing
    ├── src/lib/useAppData.js    ← Single source of truth (state + Supabase sync)
    ├── src/lib/db.js            ← All Supabase CRUD operations
    ├── src/lib/allocate.js      ← Pure allocation algorithm (no side effects)
    ├── src/lib/constants.js     ← SIDES, GENDERS, FLOORS
    ├── src/lib/supabase.js      ← Supabase client (reads env vars)
    ├── src/tabs/                ← GuestsTab, RoomsTab, PairsTab, AllocateTab
    ├── src/components/UI.jsx    ← Shared primitive components
    └── src/TestRunner.jsx       ← 31 algorithm tests (lazy, ?tests URL only)

Supabase (PostgreSQL)
    ├── guests                   ← UUID pk, name, gender, side, family, confirmed
    ├── rooms                    ← UUID pk, number, floor, capacity, notes
    ├── pairs                    ← UUID pk, FK→guests(a), FK→guests(b)
    └── app_state                ← Singleton row: active_tab + result (JSONB)
```

**No Netlify Functions needed** — the Supabase JS SDK talks directly to Supabase
from the browser using the anon key + Row-Level Security policies.

---

## Step 1 — Set up Supabase (5 minutes)

### 1.1 Create a project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `innvite`), set a strong DB password, pick a region
3. Wait ~2 minutes for provisioning

### 1.2 Run the schema
1. In your Supabase project: **SQL Editor** → **New query**
2. Open `supabase-schema.sql` from this project
3. Paste the entire contents → **Run**
4. You should see: *"Success. No rows returned."*

### 1.3 Get your API keys
Go to **Settings** → **API**:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | "Project URL" — looks like `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | "Project API keys" → `anon` `public` |

> ⚠️ **Never use the `service_role` key in frontend code.** The `anon` key is safe
> because Row-Level Security policies restrict what it can do.

---

## Step 2 — Deploy to Netlify (5 minutes)

### Option A: Deploy via Git (recommended — automatic redeploys)

**1. Push to GitHub**
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/innvite.git
git push -u origin main
```

**2. Connect to Netlify**
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings (auto-detected from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site** — this first deploy will fail (env vars not set yet, that's fine)

**3. Set environment variables**
1. Netlify Dashboard → your site → **Site configuration** → **Environment variables**
2. Click **Add a variable** for each:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` |

3. Go to **Deploys** → **Trigger deploy** → **Deploy site**

---

### Option B: Deploy via Netlify CLI (no Git required)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the project
npm install
npm run build

# Deploy (follow prompts)
netlify deploy --prod --dir=dist
```

Set env vars the same way in the Netlify dashboard, then redeploy.

---

### Option C: Drag & Drop (quickest, no CLI)

```bash
npm install
npm run build
```

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `dist/` folder onto the page
3. Set env vars in site settings → redeploy

---

## Step 3 — Verify

1. Open your Netlify URL (e.g. `https://your-site.netlify.app`)
2. Add a guest → it should appear immediately
3. Open the same URL on your phone → the guest should already be there (real-time sync)
4. To run the 31 algorithm tests: `https://your-site.netlify.app?tests`

---

## Local Development

```bash
# 1. Clone / download the project
git clone ...
cd innvite

# 2. Install dependencies
npm install

# 3. Create local env file (never commit this)
cp .env.example .env
# Edit .env and fill in your real Supabase URL and anon key

# 4. Start dev server
npm run dev
# → http://localhost:5173
```

---

## Database Schema Summary

```sql
-- Guests
guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  gender      TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  side        TEXT CHECK (side IN ('bride_dad','bride_mom','groom_dad',
                                   'groom_mom','bride_friends','groom_friends')),
  family      TEXT DEFAULT '',
  confirmed   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- Rooms
rooms (
  id          UUID PRIMARY KEY,
  number      TEXT NOT NULL UNIQUE,
  floor       TEXT CHECK (floor IN ('Ground','1st','2nd','3rd','4th','5th')),
  capacity    INTEGER CHECK (capacity >= 1 AND capacity <= 50),
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- Preferred roommate pairs
pairs (
  id          UUID PRIMARY KEY,
  a           UUID REFERENCES guests(id) ON DELETE CASCADE,
  b           UUID REFERENCES guests(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
  -- Unique constraint prevents (A,B) and (B,A) duplicates
)

-- Singleton app state
app_state (
  id          TEXT PRIMARY KEY DEFAULT 'singleton',
  active_tab  TEXT DEFAULT 'guests',
  result      JSONB,   -- allocation result: { placed, unplaced }
  updated_at  TIMESTAMPTZ DEFAULT now()
)
```

---

## Features

| Feature | How it works |
|---|---|
| **Multi-device sync** | Supabase Realtime subscriptions — changes appear on all open tabs/phones instantly |
| **Persistent allocation** | Result stored as JSONB in `app_state`. Survives browser close, cache clear, device switch |
| **Strict side isolation** | Algorithm enforces zero cross-side room sharing |
| **Family integrity** | Families are atomic units — never split unless forced |
| **Preferred pairs** | Honored first before greedy group formation |
| **Manual override** | Move guests between rooms; persisted immediately to Supabase |
| **Export/Import** | JSON backup — export and import on any device |
| **Test runner** | 31 tests accessible at `?tests` — zero impact on prod bundle |

---

## Security

- **Anon key only in browser** — safe because RLS policies restrict it to allowed operations
- **Row Level Security** enabled on all tables
- **No service role key** ever exposed to frontend
- **HTTPS only** — Netlify enforces HTTPS automatically
- **Security headers** set in `netlify.toml` (X-Frame-Options, CSP-adjacent)
- The `anon` key is intentionally public — it's designed to be in browser code

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page on Netlify | Check env vars are set; check browser console for "Missing env vars" |
| Data not loading | Confirm schema was run in Supabase; check Supabase project isn't paused (free tier pauses after 1 week inactive) |
| Real-time not working | Make sure `alter publication supabase_realtime add table ...` ran in schema |
| Import fails | Re-run the full `supabase-schema.sql` to ensure all tables exist |
| Supabase project paused | Free tier pauses after 1 week of no requests — just visit the app to wake it |

---

## Free Tier Limits (both services)

**Supabase free tier:**
- 500 MB database storage
- Unlimited API requests
- 2 GB bandwidth/month
- Project pauses after 1 week of inactivity (resumes on first request)

**Netlify free tier:**
- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites
- Custom domain support

Both are more than sufficient for a wedding (typically < 200 guests, < 100 rooms).
