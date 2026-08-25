# Features Roadmap

Prioritized feature ideas based on user research across Trainerize, TrueCoach, MyPTHub,
and direct feedback. Each item describes the problem, the proposed solution, and the
rough implementation path inside our modular monolith.

Features are grouped by who they primarily serve, then ordered by implementation priority.

---

## Gym Owners

---

### 1 — At-Risk & Prospect Member Tracking

**Priority: Now**

#### Problem

Gym owners and trainers discover churn after the fact. By the time a member stops paying,
they've already mentally quit. There's no proactive signal: "this person hasn't trained in
10 days" or "this athlete has no active program — they're probably drifting."

This also applies to **prospects**: people who registered but never logged their first
session, or trialists who did one session and disappeared.

#### What we build

A new **Members Health** view accessible to `gym_admin` and `trainer` roles. It surfaces
athletes grouped by status:

| Status | Definition |
|--------|-----------|
| **Active** | At least one session logged in the last 10 days |
| **At-Risk** | Last session was 10–30 days ago |
| **Dormant** | No session in 30+ days (or never logged one) |
| **No Program** | Belongs to the org but has no active training program assigned |
| **New** | Joined in the last 7 days — needs onboarding attention |

Trainer can click any athlete → go to their detail/progression page → send a message or
assign a program without leaving the flow.

Optional: a "Nudge" button that triggers an in-app notification or email to the athlete.

#### Trigger rules (configurable per org)

```
inactivity_alert_days      = 10   # days without a logged session
no_program_alert_days      = 10   # days since joined without an assigned program
dormant_days               = 30   # days until considered dormant
```

These live as org-level settings so a boutique studio (trains 3x/week) can tighten them
and a general gym (trains 1x/week) can loosen them.

#### Backend

**New endpoint:**
```
GET /api/v1/identity/organizations/current/member-health
```
Returns a list of memberships annotated with `status`, `last_session_at`,
`active_program_count`, `days_since_last_session`.

**Service logic** (`identity` module, calls into `logs` and `training` via their public
service interfaces — no direct cross-module DB access):
1. Load all memberships for the org.
2. For each member: fetch `last_session_at` from `LogsService.get_last_session_date(user_id)`.
3. For each member: fetch `active_program_count` from `TrainingService.count_active_programs(user_id)`.
4. Compute status from the thresholds above.
5. Return sorted: New → At-Risk → No Program → Dormant → Active.

No background job needed for MVP — computed on demand. Add caching (Redis, 5 min TTL)
once query volume warrants it.

**New table** (phase 2): `identity.member_nudges` — stores who sent a nudge, when, and
via what channel. Prevents spamming the same athlete every day.

#### Frontend

- New tab in the gym owner/trainer sidebar: **Members** (replaces or extends `/athletes`).
- Header shows 4 stat chips: Active / At-Risk / Dormant / No Program counts.
- Filterable list with colored status badges.
- "Assign program" and "Send message" quick actions per row.

#### i18n keys

```
memberHealth.title
memberHealth.active
memberHealth.atRisk
memberHealth.dormant
memberHealth.noProgram
memberHealth.newMember
memberHealth.lastSession
memberHealth.neverLogged
memberHealth.nudge
memberHealth.assignProgram
```

---

### 2 — Attendance Tracking

**Priority: Next**

#### Problem

Gym owners need to see who shows up and when — not just who has logged a workout, but
physical check-in to the facility. Useful for identifying dead hours, justifying a
trainer's schedule, and correlating attendance with retention.

#### What we build

A daily attendance log per member per org. Two entry modes:

- **Auto**: attendance is recorded when a member logs a workout session (already have this
  data in `logs.sessions`).
- **Manual check-in**: trainer or front desk marks a member as present (for drop-in classes
  or when the member doesn't log in real time).

Reports:
- Attendance heatmap (week × hour) — shows busiest/quietest times.
- Per-member attendance rate (sessions per week, rolling 30 days).
- Overall gym headcount per day/week/month.

#### Backend

**New table** in `logs` schema:
```sql
logs.attendance (
  id uuid PK,
  organization_id uuid FK,
  user_id uuid FK,
  checked_in_at timestamptz,
  source text   -- 'session_log' | 'manual'
)
```

`LogsService.create_session()` emits a `logs.session_created` event. An `AttendanceService`
listener records a `session_log` entry automatically.

Manual check-in endpoint (gym_admin/trainer only):
```
POST /api/v1/logs/attendance/checkin  { user_id }
GET  /api/v1/logs/attendance/summary  → heatmap + per-member rates
```

#### Frontend

- Gym owner dashboard widget: today's headcount + comparison to last week.
- Attendance report page with heatmap chart and sortable member table.

---

### 3 — Revenue & Business Analytics Dashboard

**Priority: Later**

#### Problem

Gym owners currently have no visibility into their business health: active vs. churned
members, monthly recurring revenue, plan distribution, or trial-to-paid conversion.
Decisions are made on gut feeling rather than data.

#### What we build

A read-only **Business** dashboard (gym_admin only) showing:

- **MRR** — monthly recurring revenue (requires billing integration or manual plan price config).
- **Active members** — total + trend vs. prior 30 days.
- **Churn rate** — members who left in the last 30/90 days.
- **Plan distribution** — breakdown by `organization.plan` (free / pro / etc.).
- **New members this month** vs. same period last month.
- **Average sessions per member per week** — leading indicator of engagement.

#### Backend

These are aggregation queries over existing tables (`identity.memberships`,
`logs.sessions`, future `billing.subscriptions`). No new tables needed for phase 1.

New endpoint:
```
GET /api/v1/analytics/organizations/current/business-summary
```

Response shape:
```json
{
  "active_members": 42,
  "active_members_delta": +3,
  "churn_last_30d": 2,
  "avg_sessions_per_member_per_week": 2.4,
  "new_members_this_month": 7
}
```

#### Frontend

- New **Business** link in sidebar (gym_admin only, hidden from trainers and athletes).
- Stat cards at the top + line chart for member count over the last 12 months.

---

### 4 — Class / Group Session Scheduling

**Priority: Later**

#### Problem

Many gyms run group classes (CrossFit WODs, bootcamps, spin classes) where multiple
athletes follow the same program on the same day at the same time. The current model only
supports 1:1 trainer → athlete program assignment. Gym owners running group classes leave
the app because of this gap.

#### What we build

A **class** is a scheduled instance of a training program with a fixed time slot and a
capacity limit. Members can self-enroll (or be enrolled by a trainer).

- Trainer creates a class: program + date/time + capacity.
- Athletes see upcoming classes and enroll.
- When the class occurs, all enrolled athletes get the same session pre-populated in their
  log (they fill in actual weights/reps during or after).
- Attendance is automatically recorded for enrolled members.

#### Backend

New tables in `training` schema:
```sql
training.classes (
  id uuid PK,
  organization_id uuid FK,
  program_id uuid FK,
  trainer_id uuid FK,
  scheduled_at timestamptz,
  capacity int,
  notes text
)
training.class_enrollments (
  id uuid PK,
  class_id uuid FK,
  athlete_id uuid FK,
  enrolled_at timestamptz
)
```

Endpoints:
```
GET  /api/v1/training/classes              → upcoming classes for org
POST /api/v1/training/classes              → create class (trainer/admin)
POST /api/v1/training/classes/{id}/enroll  → athlete self-enroll
DELETE /api/v1/training/classes/{id}/enroll → unenroll
```

---

## Personal Trainers

---

### 5 — Export Training Program to PDF

**Priority: Now**

#### Problem

Trainers often need to hand a program to an athlete in print or share it via WhatsApp/email
without requiring the athlete to have the app. No existing competitor does this well —
most either produce ugly raw exports or don't offer it at all.

#### What we build

A "Download PDF" button on any training program detail view. The generated PDF includes:

- Program name, description, and creation date.
- Trainer name and gym logo (if set on the org).
- Each exercise in order: name, muscle group, sets × reps @ RPE, rest period, notes.
- Demo video URL shown as a short URL + QR code (scannable from the printed page).
- Optional: weekly schedule grid if the program has day assignments.

#### Backend

**New endpoint:**
```
GET /api/v1/training/programs/{program_id}/export/pdf
```
Response: `application/pdf` with `Content-Disposition: attachment; filename="program-name.pdf"`.

**Library:** `weasyprint` — renders HTML/CSS to PDF. Lets us write the layout in a Jinja2
template instead of low-level drawing code, so the output looks as good as our web UI.

Add to `backend/pyproject.toml`:
```
"weasyprint>=62.0"
"jinja2>=3.1"
"qrcode>=7.4"
```

**Template:** `backend/modules/training/templates/program_export.html`
A minimal, print-optimized HTML page using inline CSS. Renders:
- Logo from org settings (future `organization.logo_url` field).
- Exercise table with alternating row shading.
- QR code for each `demo_video_url`.

**Service method** in a new `ProgramExportService`:
```python
async def export_pdf(self, current_user, program_id) -> bytes
```
1. Load program + exercises.
2. Render Jinja2 template to HTML string.
3. Pass to `weasyprint.HTML(string=html).write_pdf()`.
4. Return bytes — router streams as `StreamingResponse`.

**Authorization:** trainer/gym_admin of the owning org, or any athlete the program is
assigned to.

#### Frontend

- In the program detail view (trainer side): `Export PDF` button next to Edit.
- In the athlete's assigned programs view: `Download` icon.
- Calls `GET /training/programs/{id}/export/pdf` and triggers browser download via
  `URL.createObjectURL`.

```typescript
// frontend/lib/api/training.ts
export async function exportProgramPdf(programId: string): Promise<Blob> {
  const res = await api.get(`/training/programs/${programId}/export/pdf`, {
    responseType: 'blob',
  })
  return res.data
}

// Hook — one-shot mutation, not a query
export function useExportProgramPdf() {
  return useMutation({
    mutationFn: (programId: string) => exportProgramPdf(programId),
    onSuccess: (blob, programId) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `program-${programId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}
```

#### i18n keys

```
training.exportPdf
training.downloadProgram
training.exportingPdf
```

---

### 6 — Automated Nudges

**Priority: Next**

#### Problem

Trainers with 20–30+ active clients cannot manually check who hasn't trained recently.
The at-risk tracking view (feature 1) surfaces the problem, but the trainer still has to
act on it manually every day. Nudges close that loop automatically.

#### What we build

Configurable automated notifications sent to at-risk athletes without trainer intervention:

- "You haven't trained in X days — your trainer {name} has a program ready for you."
- "Time to log this week's session — keep your streak going."
- Trainer sees a log of sent nudges per athlete to avoid duplicates.

**Channels** (phase 1): email only. Push notification (phase 2) once a mobile app exists.

#### Backend

A scheduled task (APScheduler or a cron endpoint called by an external scheduler) runs
daily at a configurable time (e.g. 09:00 org local time):

1. Query at-risk and dormant athletes (same logic as feature 1).
2. For each: check `identity.member_nudges` — if a nudge was sent in the last N days, skip.
3. Send email via configured SMTP/transactional email provider (SendGrid, Resend, etc.).
4. Record nudge in `identity.member_nudges`.

New org-level settings:
```
nudge_enabled            = true
nudge_inactivity_days    = 10
nudge_cooldown_days      = 7    # min days between nudges to same athlete
```

---

### 7 — In-App Messaging (Trainer ↔ Athlete)

**Priority: Later**

#### Problem

The single most-cited complaint across every competing app. Trainers manage follow-ups,
check-ins, and motivation through WhatsApp — completely outside the platform. Context is
lost, response rates drop, and there's no record of communication.

#### What we build

A simple threaded message inbox. One thread per trainer–athlete pair within an org.
No group chats for now.

- Trainer can message any athlete in their org.
- Athlete can reply.
- Unread badge in the sidebar nav.
- Messages are plain text for MVP; file/image attachments in v2.

#### Backend

New module: `messages`. Schema: `identity.messages`.

```sql
identity.messages (
  id uuid PK,
  organization_id uuid FK,
  sender_id uuid FK → users,
  recipient_id uuid FK → users,
  body text,
  sent_at timestamptz,
  read_at timestamptz nullable
)
```

Endpoints:
```
GET  /api/v1/messages/threads              → list threads (last message + unread count)
GET  /api/v1/messages/threads/{user_id}    → full message history with that user
POST /api/v1/messages/threads/{user_id}    → send a message
POST /api/v1/messages/threads/{user_id}/read → mark thread as read
```

Real-time delivery (phase 2): WebSocket or Server-Sent Events. For MVP, polling every
30s is acceptable.

---

### 8 — Weekly Check-In Forms

**Priority: Later**

#### Problem

Trainers need qualitative feedback beyond the numbers — sleep quality, stress, soreness,
energy. This is how they decide whether to increase load next week or back off. There's
currently no structured way to collect this, so trainers ask via WhatsApp and lose the
data immediately.

#### What we build

A trainer creates a **check-in form** (3–5 questions: rating scales 1–5 or short text).
The system sends the athlete a weekly prompt. Athlete fills it in from their dashboard.
Trainer sees the history alongside the progression chart.

#### Backend

New tables in `training` schema:
```sql
training.checkin_templates (id, organization_id, trainer_id, name, questions jsonb)
training.checkin_responses (id, template_id, athlete_id, answers jsonb, submitted_at)
```

Questions as JSON:
```json
[
  { "id": "sleep",    "label": "Sleep quality (1–5)",    "type": "rating" },
  { "id": "soreness", "label": "Overall soreness (1–5)", "type": "rating" },
  { "id": "notes",    "label": "Anything to report?",    "type": "text"   }
]
```

---

### 9 — Progress Photos

**Priority: Next**

#### Problem

Strength numbers are one data layer; visual body composition change is another. Athletes
and trainers track progress photos separately (WhatsApp, camera roll) with no link back
to the training data. Trainers can't see the visual trend alongside performance.

#### What we build

Athletes upload front/side/back photos tied to a specific date. Photos appear on a
timeline in the athlete's profile — visible to both the athlete and their trainer.

- Upload up to 3 photos per entry (front, side, back).
- Photos stored on the media volume (same system as exercise demo videos).
- Timeline view: scroll through dates, compare any two dates side by side.

#### Backend

New table in `logs` schema:
```sql
logs.progress_photos (
  id uuid PK,
  user_id uuid FK,
  organization_id uuid FK,
  taken_at date,
  photo_url_front text,
  photo_url_side  text,
  photo_url_back  text,
  notes text
)
```

Upload endpoint (multipart):
```
POST /api/v1/logs/progress-photos          → athlete uploads
GET  /api/v1/logs/progress-photos          → athlete's own timeline
GET  /api/v1/logs/athletes/{id}/progress-photos → trainer view
```

---

## Athletes

---

### 10 — Personal Records (PRs) Detection

**Priority: Next**

#### Problem

The biggest intrinsic motivation in strength training is beating your own record. Athletes
have no idea when they've hit a PR because the app doesn't tell them. This is entirely
derivable from data we already collect.

#### What we build

Automatic PR detection when a set is saved. If any set in a just-logged session exceeds
the all-time max weight for that exercise, flag it.

- PR badge on the session detail view: "New PR — Squat: 120 kg"
- Per-exercise PR shown on the progression chart as a horizontal reference line.
- Athlete profile shows a **Lifetime PRs** section (top lift per exercise).

#### Backend

`LogsService.save_set()` already writes a set. After writing, compare against the
historical max. If new weight > previous max: emit `logs.pr_set` event.

Event payload: `{ user_id, organization_id, catalog_exercise_id, weight_kg, previous_pr_kg }`.

`AnalyticsService` subscribes and writes to `analytics.personal_records`.

New endpoints:
```
GET /api/v1/analytics/me/personal-records              → own PRs
GET /api/v1/analytics/athletes/{id}/personal-records   → trainer view
```

---

### 11 — Body Measurements Log

**Priority: Next**

#### Problem

Strength metrics only tell half the story. Athletes and trainers track weight, body fat %,
and tape measurements over time but currently store this in notes or a separate spreadsheet,
with no link to the training data.

#### What we build

A simple time-series log per athlete:

- Body weight (kg)
- Body fat % (optional)
- Waist, chest, hips, arms, thighs (cm) — all optional
- Progress photos can be linked to a measurement date (ties into feature 9)

Charts: weight over time, body fat over time — same visual pattern as the weekly volume
chart. Trainer sees the athlete's history alongside training data.

#### Backend

New table in `logs` schema:
```sql
logs.body_measurements (
  id uuid PK,
  user_id uuid FK,
  organization_id uuid FK,
  measured_at date,
  weight_kg      numeric(5,2),
  body_fat_pct   numeric(4,1),
  waist_cm       numeric(5,1),
  chest_cm       numeric(5,1),
  hips_cm        numeric(5,1),
  arms_cm        numeric(5,1),
  thighs_cm      numeric(5,1),
  notes text
)
```

Endpoints:
```
GET  /api/v1/logs/measurements               → athlete's own history
POST /api/v1/logs/measurements               → log new measurement
GET  /api/v1/logs/athletes/{id}/measurements → trainer view
```

---

### 12 — Nutrition & Macro Tracking

**Priority: Later**

#### Problem

Training load and nutrition are inseparable, but there's no way for a trainer to set
macro targets for an athlete or for the athlete to log compliance. Trainers lose clients
to apps like MyFitnessPal when they want this link. The goal is not to build a full food
database — just enough to close the loop between program and nutrition compliance.

#### What we build

- Trainer sets daily targets per athlete: calories, protein (g), carbs (g), fat (g).
- Athlete logs daily totals (not individual meals — just summary numbers, optionally
  fetched by syncing with Apple Health / MyFitnessPal export in a future phase).
- Trainer sees a compliance chart: target vs. logged over the last 4 weeks.

#### Backend

New tables in `logs` schema:
```sql
logs.nutrition_targets (
  id uuid PK,
  athlete_id uuid FK,
  organization_id uuid FK,
  set_by uuid FK,       -- trainer user_id
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  effective_from date
)
logs.nutrition_logs (
  id uuid PK,
  user_id uuid FK,
  organization_id uuid FK,
  logged_date date,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  notes text
)
```

---

### 13 — Rest Timer

**Priority: Next**

#### Problem

Rest periods between sets are as important as the sets themselves. Athletes lifting alone
have no timer — they either count in their head, use a separate app, or simply stop
tracking rest. A built-in rest timer keeps the athlete in the app and reduces inter-set
cognitive load.

#### What we build

A simple countdown timer that activates automatically when a set is marked as complete
during an active session.

- Default rest time pulled from the program exercise (`rest_seconds` field, already in the
  DB model).
- Athlete can adjust the duration on the fly.
- Timer shows as a floating pill at the bottom of the session screen.
- Sound + vibration (browser/device) when time is up.
- Purely frontend — no backend changes needed.

#### Frontend

`useRestTimer` hook:
```typescript
// state: idle | running | finished
// starts with duration from program_exercise.rest_seconds
// browser Notification API for the alert
```

Floating timer component renders on top of the session log view when state is `running`.

---

### 14 — Wearable Sync

**Priority: Later**

#### Problem

Athletes want heart rate, step count, and calories burned from their watch or fitness
band attached to their session log — without manual entry. Currently there's no way to
bring external sensor data into the platform.

#### What we build

Phase 1 — **Apple Health / Google Fit export import**: athlete downloads a Health export
and the app parses it to backfill heart rate and calorie data for logged sessions. Low
engineering cost, covers iOS users.

Phase 2 — **OAuth integrations**: Garmin Connect, Polar Flow, Strava. Each exposes a
webhook or pull API. When a workout is recorded on the wearable, we match it to the
nearest `logs.session` by timestamp and enrich it with HR + calorie data.

#### Backend

New fields on `logs.sessions`:
```sql
avg_heart_rate_bpm  int nullable
max_heart_rate_bpm  int nullable
calories_burned     int nullable
source              text  -- 'manual' | 'apple_health' | 'garmin' | 'polar'
```

Phase 2: new `integrations` module with OAuth token storage per user and webhook receivers.

---

## Priority Summary

| # | Feature | Who | Priority |
|---|---------|-----|----------|
| 1 | At-Risk & Prospect Tracking | Gym owners, Trainers | **Now** |
| 5 | PDF Export | Trainers | **Now** |
| 10 | Personal Records (PRs) | Athletes | **Next** |
| 11 | Body Measurements Log | Athletes, Trainers | **Next** |
| 9 | Progress Photos | Athletes, Trainers | **Next** |
| 6 | Automated Nudges | Trainers | **Next** |
| 13 | Rest Timer | Athletes | **Next** |
| 2 | Attendance Tracking | Gym owners | **Next** |
| 7 | In-App Messaging | Trainers, Athletes | **Later** |
| 8 | Weekly Check-In Forms | Trainers | **Later** |
| 12 | Nutrition & Macro Tracking | Athletes, Trainers | **Later** |
| 3 | Revenue & Business Analytics | Gym owners | **Later** |
| 4 | Class / Group Scheduling | Gym owners | **Later** |
| 14 | Wearable Sync | Athletes | **Later** |
