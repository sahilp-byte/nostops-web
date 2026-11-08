# Backend request — grant `admin.demo` an Admin persona

## Why
The web app routes each signed-in account to its dashboard based on the persona
returned by auth. The core-team demo accounts should each land on their own
dashboard. Four of five already do; **`admin.demo@nostops.com` does not** —
it opens the **teacher** dashboard instead of the admin/ops console.

## Evidence (read-only checks against the live API)
- `POST /api/auth/login` for `admin.demo@nostops.com` → returns `user.role = "teacher"`.
- `GET /api/auth/personas/mine` (as admin.demo) → personas list contains ONLY
  `{"role":"teacher", ...}` — there is **no admin persona** on the account.
- `POST /api/auth/login-by-role` with `{"role":"admin", email, password}` →
  `role_mismatch` (the account has no admin persona to switch into).

## Requested change (backend / data only — web app needs no change)
Attach an **admin** persona to the `admin.demo@nostops.com` account so that:
1. `GET /api/auth/personas/mine` includes a persona with `role: "admin"`, and
2. `POST /api/auth/login-by-role {role:"admin"}` (or the default `POST /auth/login`)
   returns `user.role = "admin"` for that account.

Once the admin persona exists, the web app will automatically render the admin
ops overview at `/app` for `admin.demo` — no frontend change is required.

## Credentials for verification
`admin.demo@nostops.com` / `<demo-password>`

## Update (2026-06) — now blocking the Teacher Discovery dashboard
Live Teacher Discovery has completed across all 9 launch cities: **638 provisional
teacher candidates** are stored and waiting for admin review, accept/reject, CSV
export, and claim-invite actions in the Admin Discovery dashboard
(`/app/admin/discovery`). That dashboard is admin-role gated. Because `admin.demo`
has no admin persona, the core team currently cannot open it. Granting the admin
persona (above) immediately unlocks candidate review/export for all 9 cities — no
frontend change needed.

Per-city accepted candidates: Pune 72, Mumbai 99, Delhi 83, Bangalore 79,
Hyderabad 72, Gurgaon 62, Navi Mumbai 60, Chandigarh 57, Nashik 54.
