# BACKEND REQUEST — Expose the teacher's approved intro video (+ confirm rich onboarding fields) on the PUBLIC profile payload

Status: **requested** (frontend ready; renders these the moment the backend adds them)
Endpoint: `GET /api/teachers/public/{handle}`
Consumer: `app/(public)/teachers/[handle]/page.tsx` (the redesigned public Yoga Teacher profile)

## Context
The redesigned public profile now shows the full onboarding story for teachers who are
**Verified AND Empanelled**. Most rich fields are ALREADY returned by
`GET /api/teachers/public/{handle}` and are now surfaced on the page:

- `yoga_dimensions` (body / mind / special_needs) ✅
- `paramparas` (multi) ✅ and `parampara` + `parampara_full` ✅
- `lineage_path` (Guru–Shishya chain) ✅
- `root_guru_name`, `root_guru_location`, `lineage_declaration` ✅
- `stats` (batches_taught / students_reached / avg_nps / retention_pct) ✅
- `empanelment_cert` (cert_id / issued_at / reviewer_name / co_signer_name) ✅
- `social_media` (instagram / youtube / linkedin / website) ✅
- offers_* + `premium_session` + `rating` + `experience_years` + `styles` + `specializations` ✅

## The one gap: the 90-second intro video
The public payload does **not** expose the teacher's approved intro video.
`sample_video_url` is `null` and there is no public `video_intro` object.
The video only exists on the AUTHENTICATED self record (`GET /api/teachers/me/video-intro`,
which returns `{ video_intro: { status, secure_url, poster_url, duration_seconds, ... } }`).

### Requested change
On `GET /api/teachers/public/{handle}`, for teachers whose video_intro `status === "approved"`,
include a public, PII-free video object, e.g. either:

```jsonc
// Option A — reuse the same shape (preferred)
"video_intro": {
  "status": "approved",
  "secure_url": "https://res.cloudinary.com/.../video/upload/.../intro.mp4",
  "poster_url": "https://res.cloudinary.com/.../intro.jpg",
  "duration_seconds": 82
}
```
```jsonc
// Option B — a flat field
"sample_video_url": "https://res.cloudinary.com/.../video/upload/.../intro.mp4"
```

Rules:
- Only expose the video when `status === "approved"` (never pending / rejected / processing).
- Only for publicly-visible, verified + empanelled teachers (same gate as the rest of the payload).
- No signed/expiring or account-scoped URLs — a plain public Cloudinary delivery URL.

### Frontend behaviour today (no backend change needed to be safe)
The page already reads BOTH `sample_video_url` and `video_intro.secure_url` (when
`video_intro.status === "approved"`) and renders an inline `<video>` player for direct
video URLs (mp4/webm/mov or Cloudinary `/video/upload/` paths), otherwise a "Watch intro
video" link. Until the backend ships one of the above, the video section simply stays hidden.

## Acceptance
- A verified + empanelled teacher who has an approved intro video sees it play inline on
  `https://www.nostops.org/teachers/{handle}` with no auth.
- No private fields (email/phone/whatsapp/payout/kyc/bank/user_id/geo) are added to the payload.
