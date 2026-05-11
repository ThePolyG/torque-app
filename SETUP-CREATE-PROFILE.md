# Create-Profile Wizard — Setup Checklist

Everything you (Chris) need to do to fully light up the "Create Your Profile" wizard.
The wizard **already works** the moment this branch merges — these steps add the
Google-native pieces (real satellite map · leads auto-appended to a Sheet).

---

## 0 · Preview first (no setup needed)

Vercel auto-builds a preview for the `feat/create-profile-wizard` branch. Find the
preview URL in your **Vercel dashboard → torque-app → Deployments** (the one tagged
with the branch name). Open it — the wizard pops up. The map step shows a "pending
setup" placeholder until step 2 below. Everything else is testable now.

---

## 1 · Google Cloud — Maps API (~5 min)

1. **console.cloud.google.com** → pick (or create) your project
2. **APIs & Services → Library** → enable:
   - **Maps JavaScript API**
   - **Geocoding API**
3. **APIs & Services → Credentials → Create Credentials → API key**
4. Click the new key → **Application restrictions → Websites** → add:
   - `thepolyg.com/*`
   - `*.thepolyg.com/*`
   - `localhost:3000/*` (so it works in local dev)
5. **API restrictions** → restrict to: Maps JavaScript API, Geocoding API
6. Copy the key
7. **Make sure billing is attached to the project** (Maps won't run without it — the $200/mo free credit covers low traffic easily; you'll likely never be charged)

➡️ This key goes in the env var `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (step 4).

---

## 2 · Google Cloud — service account for the Leads sheet (~5 min)

1. **APIs & Services → Library** → enable **Google Sheets API**
2. **IAM & Admin → Service Accounts → Create service account**
   - name: `pmg-leads-writer` (or anything)
   - role: none needed (the sheet share grants access)
3. On the new service account → **Keys → Add key → Create new key → JSON** → downloads a `.json` file
4. **Create a Google Sheet** named "PMG Leads" — first row a header:
   `Timestamp | Name | Email | Phone | Contact method | Best time | Category | Detail | Origin | Destination | Distance (mi) | Timeline | Notes | Referral | Budget | Source | Photos | Status`
5. **Share that sheet** with the service account's email (it looks like `pmg-leads-writer@yourproject.iam.gserviceaccount.com`) — give it **Editor**
6. Copy the **Sheet ID** from the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

➡️ The JSON file's contents go in `GOOGLE_SERVICE_ACCOUNT_JSON`. The Sheet ID goes in `PMG_LEADS_SHEET_ID`.

---

## 3 · Resend (probably already done)

`RESEND_API_KEY` is already used by the existing transcript email — if it's set in
Vercel, you're good. Optional: `LEAD_NOTIFY_EMAIL` (defaults to `chris@thepolyg.com`).

> Note: the wizard emails currently send `from: PMG <onboarding@resend.dev>` (Resend's
> shared test sender — works fine for inbound notifications to you). When you want
> outbound emails to come from `@thepolyg.com`, verify that domain in Resend and we'll
> swap the `from:` address — a 2-line change.

---

## 4 · Set the env vars in Vercel

**Vercel dashboard → torque-app → Settings → Environment Variables.** Add (Production
+ Preview + Development):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | the API key from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | paste the **entire** contents of the service-account `.json` file (the whole `{...}` blob) — or its base64 |
| `PMG_LEADS_SHEET_ID` | the Sheet ID from step 2 |
| `PMG_LEADS_SHEET_TAB` | `Leads` (or whatever you named the tab) |
| `LEAD_NOTIFY_EMAIL` | `chris@thepolyg.com` (optional — that's the default) |
| `RESEND_API_KEY` | (should already be there) |

For **local dev** (`npm run dev`), copy `.env.local.example` to `.env.local` and fill
the same values there. `.env.local` is gitignored — never commit it.

> ⚠️ Don't paste any of these keys into a chat. Only into the Vercel dashboard or your
> local `.env.local` file. (Doctrine: credentials never in chat.)

---

## 5 · Go live

Once the preview looks good and the env vars are set:
- Merge `feat/create-profile-wizard` → `main` (or open the PR Vercel suggested and merge it)
- Vercel auto-deploys `main` → live on `thepolyg.com`
- The modal pops up · the map works · leads land in the sheet AND in your inbox

---

## What's NOT in this version (v1.1 backlog)

- Photos → Google Drive folder (currently photos come as email attachments — first 4 in the email; the rest are noted)
- `from: @thepolyg.com` (needs the Resend domain verification above)
- Optional Gmail-API notification instead of Resend (fully native — Resend works fine for now)
- Rollout to `flagstafftransport.pro` and other client sites (the wizard already accepts a `?source=` tag for this — just needs deploying there once their environments are set up)

---

## Tuning after you see it live (no rebuild — just edits)

- Service categories / dropdown options → `src/app/components/CreateProfileModal.tsx` (the `CATEGORIES` array near the top)
- Headline / button copy / confirmation message → same file, the step-content blocks
- Map default center/zoom → `src/app/components/GoogleMapPicker.tsx` (the `FLAGSTAFF` const + `defaultZoom`)
