# gym-logs — Frontend

React SaaS interface for gym-logs. Athletes log workouts and view progression.
Trainers and gym admins manage programs, clients, and memberships.

Read the root `CLAUDE.md` for project overview and backend API contracts.

## Stack
- **Next.js 15** — App Router, TypeScript strict mode
- **Tailwind CSS + shadcn/ui** — utility-first styling, accessible components
- **TanStack Query v5** — server state: data fetching, caching, mutations
- **Axios** — HTTP client with auth interceptors
- **React Hook Form + Zod** — form state + runtime schema validation
- **Zustand** — minimal client-only state (auth tokens in memory)
- Package manager: **pnpm**. Lint + format: **ESLint + Prettier**. Tests: **Vitest + Testing Library**.

---

## Usability Contract

Every component and page in this codebase is held to **Nielsen's 10 Usability Heuristics**.
These are not aspirational guidelines — they are shipping criteria.

> **A component is not done until it passes `/check-heuristics <path>`.**
> Zero FAIL, at most 2 WARN, in both DESIGN mode (before code) and IMPLEMENTATION mode (after code).

Run the agent:
```
/check-heuristics design: <description of planned component>   ← before writing code
/check-heuristics frontend/components/auth/login-form.tsx      ← after writing code
/check-heuristics all                                          ← full audit before a release
```

The agent is defined in `.claude/agents/heuristics-checker.md`.
It audits every heuristic, produces a structured PASS / WARN / FAIL report, and lists priority fixes.

---

### The 10 Heuristics — Concrete Rules for This Codebase

#### H1 — Visibility of System Status
*Keep users informed about what is happening, through timely feedback.*

- Every async mutation (submit, delete, save) must disable its trigger and show a loading indicator while pending. No silent waiting.
- Every data-loading screen shows a skeleton that matches the layout of the loaded content. No spinners for list/grid content.
- Successful mutations confirm via a `<Toast>` notification. The message names what changed ("Workout logged", "Program saved").
- The active navigation item is always visually distinct (left indicator bar + `bg-accent`). The user always knows where they are.

#### H2 — Match Between System and Real World
*Speak the user's language. Use words and concepts familiar to the user, not system terminology.*

- UI copy uses gym/fitness domain language: "workout log", "set", "rep", "RPE", "PR" — never "record", "entry", "payload".
- Dates are human-formatted via a shared `formatDate()` utility: "Today", "Yesterday", "Jun 14" — never raw ISO strings in the UI.
- Weights, reps, and durations use units: "80 kg × 5 reps", "1h 23m" — never unitless numbers on their own.
- All icons are paired with visible text labels. No icon-only buttons except ✕ (close) and ≡ (menu).

#### H3 — User Control and Freedom
*Users make mistakes. Provide clearly marked "emergency exits".*

- Destructive actions (delete workout, remove member) always open a `<AlertDialog>` confirmation. No immediate irreversible action on a single click.
- Every `<Dialog>` and `<Sheet>` has a visible close button and closes on Escape keypress.
- Multi-step flows (e.g., program creation wizard) have a visible "Back" button on every step except the first.
- Filters and sort controls always include a "Clear" or "Reset" action.

#### H4 — Consistency and Standards
*Users should not have to wonder whether different words or actions mean the same thing.*

- **One button hierarchy**: primary violet button for the main CTA per screen, secondary/outline for secondary actions, ghost for tertiary. Never deviate.
- **One terminology**: if the backend says `organization`, the UI says "gym" or "organization" — pick one and commit. Never mix synonyms across views.
- **One page structure**: every authenticated page uses the sidebar shell from `(dashboard)/layout.tsx`. No one-off full-page layouts inside the dashboard.
- **One form pattern**: label above, shadcn `<Input>`, `<FormMessage>` below — every field on every form.
- **One date formatter**, one number formatter — always imported from `lib/utils.ts`. No inline `toLocaleDateString()` calls.

#### H5 — Error Prevention
*Design that prevents problems is better than good error messages.*

- Zod schema validation runs client-side on every `onChange` after first submit attempt. The form never sends invalid data.
- Submit buttons are disabled (`disabled={!form.formState.isValid}`) until the form is valid.
- Number inputs (`sets`, `reps`, `weight`) always have `min`, `max`, and `step` HTML attributes.
- Dangerous confirmation dialogs require the user to type a confirmation phrase for irreversible bulk actions.
- `required` attribute is set on all required fields; required fields are marked with an asterisk in their `<FormLabel>`.

#### H6 — Recognition Rather Than Recall
*Minimize memory load — make options and context visible.*

- Active sidebar nav item is always highlighted. The page `<h1>` always names the current section.
- Exercise name inputs use `<Combobox>` with autocomplete from the exercise catalog. Users pick, they don't type from memory.
- Empty states are instructional: "You haven't logged a workout yet. [Log your first workout →]" — not just "No data."
- Recently used exercises surface at the top of the picker.
- Breadcrumbs appear on any page deeper than one level (e.g., Program → Session → Exercise).

#### H7 — Flexibility and Efficiency of Use
*Support both novice and power users.*

- `Enter` submits the focused form. `Escape` closes the active dialog or sheet.
- Focus moves to the first interactive element when a dialog opens; returns to the trigger when it closes (`returnFocus`).
- All `<form>` elements have a correct `tabIndex` order. Tab navigation is logical and never jumps unexpectedly.
- Long lists (> 10 items) always have a search or filter. No endless scrolling without filtering.
- Key flows (log a set, open today's workout) are reachable in ≤ 2 clicks from the dashboard.

#### H8 — Aesthetic and Minimalist Design
*Remove everything that does not help. Every element competes for attention.*

- Every UI element is justified. If you cannot say in one sentence why it is there, remove it.
- Tables and cards show only the fields the user needs at that glance. Full detail lives in a detail view or expansion.
- Forms ask only for information needed for that step. Don't collect `notes` on the same screen as basic log data.
- All colours, spacing, font sizes, and radii come from the design tokens in this file. No one-off hex values in component code.
- shadcn/ui components are used for every standard pattern (button, input, dialog, select, etc.) — no custom-built alternatives to existing shadcn components.

#### H9 — Help Users Recognize, Diagnose, and Recover from Errors
*Error messages should be in plain language, name the problem, and suggest a fix.*

- API errors are caught in the Axios interceptor and transformed to `{ message: string }` before reaching components. Never render raw `{"detail": "..."}` to the user.
- Field-level errors name the field and state the fix: "Password must be at least 8 characters" — not "Invalid input".
- Network/timeout errors show an inline alert with a "Try again" button that retries the last query or mutation.
- 404 pages include a "Go back" link and a "Go to dashboard" link.
- All error colours use `text-destructive` / `bg-destructive/10` from the design token. No custom red values.

#### H10 — Help and Documentation
*If help is needed, make it easy to find and task-focused.*

- Non-obvious metrics (RPE, volume, 1RM) have a `<Tooltip>` icon next to their label that explains the concept and scale.
- All `<Input>` placeholders give a real example: `e.g., Bench Press` — never a restatement of the label.
- Password and complex field requirements are shown as hints *before* submission, not only in error messages after.
- Destructive `<AlertDialog>` bodies explain the consequence in plain language: "This will permanently delete 3 sets. You cannot undo this."
- First-time / empty states explain what the feature does and how to begin — not just that it is empty.

---

## Design System

### Principles
1. **Clarity first** — hierarchy is immediately obvious: users never wonder what to look at or what to do next.
2. **Feels instant** — optimistic updates, skeleton loaders, zero blank states. Perceived performance beats real performance.
3. **Consistent patterns** — every similar interaction uses the same pattern. If you log a set, creating a program feels familiar.
4. **Accessible by default** — every interactive element has a visible focus ring, correct contrast ratios, ARIA labels.

The visual language draws from **iOS** (generous whitespace, rounded corners, clear type hierarchy, smooth transitions)
and **Google/YouTube** (flat surfaces, strong grid, bold primary actions, consistent iconography).

---

### Color Tokens

The palette is **violet-primary / red-energy / zinc-neutral**. Violet is the brand anchor. Red marks
intensity — PRs, alerts, destructive actions. Zinc provides a clean neutral scale.

#### CSS variables (shadcn/ui format — set in `app/globals.css`)

```css
/* ─── Light mode ─── */
:root {
  /* Backgrounds */
  --background:          0 0% 100%;         /* #FFFFFF          */
  --background-subtle:   240 5% 96%;        /* #F4F4F5  zinc-100 */

  /* Surfaces (cards, popovers, sheets) */
  --card:                0 0% 100%;
  --card-foreground:     240 10% 4%;        /* #09090B  zinc-950 */
  --popover:             0 0% 100%;
  --popover-foreground:  240 10% 4%;

  /* Foreground / text */
  --foreground:          240 10% 4%;        /* #09090B  near-black */
  --muted:               240 5% 65%;        /* #A1A1AA  zinc-400  */
  --muted-foreground:    240 4% 46%;        /* #71717A  zinc-500  */

  /* Brand — Violet */
  --primary:             263 70% 50%;       /* #7C3AED  violet-600 */
  --primary-foreground:  0 0% 100%;

  /* Energy — Red */
  --destructive:         0 72% 51%;         /* #DC2626  red-600   */
  --destructive-foreground: 0 0% 100%;

  /* Secondary / ghost surfaces */
  --secondary:           240 5% 96%;        /* #F4F4F5  zinc-100  */
  --secondary-foreground: 240 10% 4%;

  /* Accent (same as primary, used by shadcn for selection highlights) */
  --accent:              263 70% 96%;       /* #EDE9FE  violet-50 */
  --accent-foreground:   263 70% 30%;       /* violet-900        */

  /* Borders & rings */
  --border:              240 6% 90%;        /* #E4E4E7  zinc-200  */
  --input:               240 6% 90%;
  --ring:                263 70% 50%;       /* violet-600 focus ring */

  /* Functional */
  --success:             160 84% 39%;       /* #059669  emerald-600 */
  --warning:             38 92% 50%;        /* #F59E0B  amber-500   */

  /* Radius */
  --radius:              0.75rem;           /* 12px — card radius   */
}

/* ─── Dark mode ─── */
.dark {
  --background:          240 10% 4%;        /* #09090B  zinc-950    */
  --background-subtle:   240 6% 10%;        /* #18181B  zinc-900    */
  --card:                240 6% 10%;        /* #18181B              */
  --card-foreground:     0 0% 98%;

  --foreground:          0 0% 98%;          /* #FAFAFA              */
  --muted:               240 4% 46%;
  --muted-foreground:    240 5% 65%;

  --primary:             263 70% 72%;       /* violet-400 — lighter on dark */
  --primary-foreground:  240 10% 4%;

  --secondary:           240 6% 17%;        /* #27272A  zinc-800    */
  --secondary-foreground: 0 0% 98%;

  --accent:              263 70% 15%;
  --accent-foreground:   263 70% 72%;

  --border:              240 6% 17%;        /* #27272A  zinc-800    */
  --input:               240 6% 17%;
  --ring:                263 70% 72%;
}
```

#### Tailwind aliases (add to `tailwind.config.ts`)

```ts
colors: {
  brand: {
    DEFAULT:  '#7C3AED',   // violet-600
    light:    '#EDE9FE',   // violet-50
    dark:     '#4C1D95',   // violet-900
    hover:    '#6D28D9',   // violet-700
  },
  energy: {
    DEFAULT:  '#DC2626',   // red-600
    light:    '#FEE2E2',   // red-100
    hover:    '#B91C1C',   // red-700
  },
}
```

---

### Typography

Font: **Inter** loaded via `next/font/google` — the cleanest cross-platform sans-serif.
Set as `font-sans` in the Tailwind base.

| Token        | Size    | Weight       | Line-height | Usage                          |
|-------------|---------|-------------|-------------|-------------------------------|
| `display`   | 3.5rem  | 700 bold     | 1.15        | Hero headings, empty states    |
| `h1`        | 2.25rem | 700 bold     | 1.25        | Page titles                    |
| `h2`        | 1.5rem  | 600 semibold | 1.3         | Section headings               |
| `h3`        | 1.125rem| 600 semibold | 1.4         | Card titles, modal titles      |
| `body`      | 0.875rem| 400 regular  | 1.6         | Default text                   |
| `body-lg`   | 1rem    | 400 regular  | 1.6         | Comfortable reading paragraphs |
| `small`     | 0.75rem | 500 medium   | 1.5         | Labels, captions               |
| `mono`      | 0.875rem| 400 regular  | 1.6         | Numbers, weights, RPE values   |

Rules:
- Use `font-tabular-nums` on all numbers (weights, sets, reps) for stable column widths.
- Never use `font-weight: 900` — 700 is the maximum used.
- Text hierarchy: size first, then weight — don't rely on colour alone to communicate hierarchy.

---

### Spacing — 8px Grid

All spacing uses multiples of 8px (Tailwind's default 4 = 1rem system maps cleanly):
`4px · 8px · 12px · 16px · 24px · 32px · 48px · 64px · 96px`

- **Page padding**: `px-6` desktop, `px-4` mobile
- **Section gap**: `gap-8` or `space-y-8`
- **Card padding**: `p-6` standard, `p-4` compact
- **Form field gap**: `space-y-4`
- **Inline element gap**: `gap-2` or `gap-3`

---

### Border Radius

| Token          | Value   | Tailwind      | Used for                          |
|---------------|---------|--------------|----------------------------------|
| `--radius`    | 12px    | `rounded-xl`  | Cards, sheets, dialogs           |
| radius - 4px  | 8px     | `rounded-lg`  | Buttons, inputs, badges          |
| radius - 8px  | 4px     | `rounded`     | Tight UI elements, table rows    |
| full          | 9999px  | `rounded-full`| Avatar, pill badges, toggles     |

Never mix radius values within a single component family — pick one and apply it consistently.

---

### Shadows & Elevation

```
Level 0 — flat:   no shadow   (default card in light mode)
Level 1 — raised: shadow-sm   (hover state, active card)
Level 2 — float:  shadow-md   (dropdowns, popovers)
Level 3 — overlay: shadow-xl  (modals, command palette)
```

Cards use `border border-border` rather than shadow in the default state. Shadow appears on hover/interaction.
This matches Google's material surface pattern: borders for static, elevation for interaction.

---

### Iconography

Use **Lucide React** (bundled with shadcn/ui). Rules:
- Default icon size: `size-4` (16px) inline, `size-5` (20px) standalone / nav items.
- Never use SVG files for icons — always import from `lucide-react`.
- Pair every icon with either visible text OR an `aria-label`. Never icon-only without a label.
- Navigation uses filled-style icons via Lucide's `*Fill` variants for the active state.

---

### Motion & Animation

Inspired by iOS transitions — purposeful, not decorative.

```ts
// Base easing — matches iOS spring feel
const ease = [0.25, 0.46, 0.45, 0.94]

// Duration tokens
const duration = {
  fast:   150,   // hover states, focus rings
  base:   200,   // accordion, dropdown open/close
  slow:   300,   // page transitions, modals
}
```

- Use `transition-colors duration-150` on all interactive elements.
- Use `animate-in fade-in-0 zoom-in-95` (shadcn/ui built-in) for dialogs and sheets.
- NEVER animate layout properties (`width`, `height`, `margin`) — only `transform` and `opacity`.
- Respect `prefers-reduced-motion` — all animations must use `motion-safe:` or check the media query.

---

### States

Every interactive element must handle all 6 states consistently:

| State      | Treatment                                                    |
|-----------|-------------------------------------------------------------|
| Default    | `border-border bg-card`                                      |
| Hover      | `hover:bg-accent` or `hover:border-brand`                   |
| Focus      | `focus-visible:ring-2 focus-visible:ring-ring` (violet ring) |
| Active     | `active:scale-[0.98]` (subtle press feedback like iOS)       |
| Disabled   | `opacity-50 cursor-not-allowed pointer-events-none`          |
| Loading    | Spinner or skeleton — never a blank/empty state              |

---

### Left Sidebar Layout

```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────┐  ┌────────────────────────────────────────┐  │
│ │  Logo   │  │         Top bar (breadcrumb + user)    │  │
│ ├─────────┤  ├────────────────────────────────────────┤  │
│ │         │  │                                        │  │
│ │  ● Logs │  │           Page content                 │  │
│ │  ○ Train│  │                                        │  │
│ │  ○ Analy│  │                                        │  │
│ │  ○ Memb.│  │                                        │  │
│ │         │  │                                        │  │
│ │─────────│  │                                        │  │
│ │  User   │  │                                        │  │
│ └─────────┘  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Sidebar width: `w-64` expanded, `w-16` collapsed (icon-only), toggled by a button
- Sidebar bg: `bg-background` with `border-r border-border`
- Active nav item: `bg-accent text-accent-foreground` with a `bg-brand` left indicator bar (3px)
- Nav items: icon (`size-5`) + label, `rounded-lg`, `h-10`, consistent padding `px-3`
- User section: pinned at the bottom of the sidebar with avatar, name, role chip
- On mobile (< `lg`): sidebar becomes a bottom drawer sheet via shadcn/ui `Sheet`

---

### Component Patterns

#### Cards
```tsx
// Standard data card
<div className="rounded-xl border border-border bg-card p-6 shadow-sm">
  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    Total Volume
  </h3>
  <p className="mt-1 text-3xl font-bold tabular-nums">12,450 kg</p>
</div>
```

#### Stat / Metric cards
- Number in `text-3xl font-bold tabular-nums`
- Label in `text-sm text-muted-foreground uppercase tracking-wide`
- Trend indicator: green arrow (up) / red arrow (down) with `text-success` / `text-destructive`
- 4-column grid on desktop, 2-column on mobile

#### Badges / Pills
```tsx
// Role badge
<span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
  Trainer
</span>

// PR badge (energy color)
<span className="rounded-full bg-energy/10 px-2.5 py-0.5 text-xs font-medium text-energy">
  PR
</span>
```

#### Empty states
Every list/table must have an empty state — never render nothing.
```tsx
<div className="flex flex-col items-center gap-3 py-16 text-center">
  <Icon className="size-10 text-muted" />
  <p className="font-semibold">No logs yet</p>
  <p className="text-sm text-muted-foreground">Log your first workout to get started.</p>
  <Button size="sm">Log a workout</Button>
</div>
```

#### Loading — Skeleton pattern
```tsx
// Use shadcn/ui Skeleton — never show a spinner for list/grid content
<Skeleton className="h-24 w-full rounded-xl" />
```
Use skeletons that match the exact layout of the loaded content. Full-page spinners are banned.

#### Forms
```tsx
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

// Always use shadcn/ui Form wrapper — it wires react-hook-form + accessibility
<Form {...form}>
  <FormField name="email" render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl><Input {...field} /></FormControl>
      <FormMessage />       {/* Shows Zod error */}
    </FormItem>
  )} />
</Form>
```

---

### Login Page Design

The login page is the first impression. It must look premium and communicate the brand immediately.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ╔═════════════╗    Left half: brand panel             │
│   ║  gym-logs   ║    • near-black background (#09090B)  │
│   ║             ║    • large wordmark (white)            │
│   ║  "Track     ║    • tagline in muted text             │
│   ║   every     ║    • subtle gradient or mesh pattern  │
│   ║   rep."     ║    • optional: stat quote or feature   │
│   ╚═════════════╝                                       │
│                         Right half: form panel          │
│                         • white background              │
│                         • centered card (max-w-sm)      │
│                         • "Sign in to your account"     │
│                         • Email + Password inputs       │
│                         • Violet "Sign in" button       │
│                         • "Forgot password?" link       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Split layout: left dark brand panel, right white form panel (50/50 on desktop)
- Mobile: form only (brand panel hidden on small screens)
- No external social login at this stage
- Error state: inline alert above submit button, `text-destructive`
- Loading: button shows spinner icon + "Signing in…", disabled

---

## Architecture rules
- NEVER put data-fetching logic in page or layout components. Pages call hooks; hooks call API functions.
- NEVER import from `app/` inside `components/`, `hooks/`, or `lib/`. The dependency arrow goes one way.
- ALL API calls live in `lib/api/<module>.ts`. No `axios.get(...)` in hooks or components.
- ALL server state goes through TanStack Query. No `useState` for data fetched from the API.
- ALWAYS use Zod schemas for form validation — define them alongside the form, not in `types/`.
- NEVER store the access token in localStorage or a cookie accessible to JS. It lives in Zustand (in-memory).
- The refresh token IS stored in localStorage (acceptable tradeoff for a SaaS with no sensitive financial data).

## Auth flow
```
1. POST /api/v1/identity/auth/login  → { access_token, refresh_token }
2. Store access_token in Zustand (memory), refresh_token in localStorage.
3. Axios interceptor attaches Authorization: Bearer <access_token> to every request.
4. On 401: interceptor calls POST /auth/refresh, rotates both tokens, retries original request.
5. On refresh 401: clear store + localStorage, redirect to /login.
6. Logout: POST /auth/logout (revokes refresh token in Redis), clear all local state.
```

## API client (`lib/api/client.ts`)
- Single Axios instance at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
- Request interceptor: reads `accessToken` from Zustand and injects `Authorization` header.
- Response interceptor: on 401, attempts token refresh, retries. On second 401, redirects to `/login`.
- All functions in `lib/api/*.ts` use this instance — never create a second Axios instance.

## TanStack Query conventions
- One custom hook per API operation: `useLogin`, `useMe`, `useLogs`, `useCreateLog`, etc.
- Queries use consistent key factories: `['logs', { orgId, date }]`.
- Mutations call `queryClient.invalidateQueries` on success — never manually update cache.
- Error objects from TanStack are always `AxiosError<ApiError>` — type them properly.

## Component conventions
- Server Components by default in `app/`. Client Components (`'use client'`) only when using hooks, state, or browser APIs.
- shadcn/ui components live in `components/ui/` — generated via `pnpx shadcn add <name>`. Never edit them.
- Feature components live in `components/<feature>/` — e.g., `components/auth/login-form.tsx`.
- File names: `kebab-case.tsx`. Component names: `PascalCase`.
- No default exports from `components/` — use named exports.

## Role-based UI
- `role` (`athlete` | `trainer` | `gym_admin`) is read from the Zustand auth store.
- Gate entire routes in `(dashboard)/layout.tsx` by role.
- Gate UI elements with a `<Can role="trainer">` component or a `useRole()` hook — never inline role strings.
- NEVER trust client-side role checks for security — backend enforces authorization.

## Types (`types/api.ts`)
Mirror the backend Pydantic response schemas exactly.
```typescript
export interface User {
  id: string
  email: string
  role: 'athlete' | 'trainer' | 'gym_admin'
  organization_id: string | null
  created_at: string
}
export interface ApiError {
  detail: string
}
```

## Environment variables
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Commands
```
pnpm dev              — start dev server (http://localhost:3000)
pnpm build            — production build
pnpm lint             — ESLint
pnpm format           — Prettier
pnpm test             — Vitest
pnpx shadcn add <name>  — add a shadcn/ui component
```

## Layout

```
frontend/
├── CLAUDE.md
├── Dockerfile
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── postcss.config.mjs
├── package.json
├── pnpm-lock.yaml
│
├── public/                        Static assets served at /
│   └── *.svg                      Icons / images — add PNGs and fonts here too
│
├── app/                           Next.js 15 App Router
│   ├── layout.tsx                 Root layout — providers only (QueryProvider, I18nProvider)
│   ├── page.tsx                   → redirects to /login or /logs
│   ├── globals.css                Tailwind base + CSS custom properties (color tokens)
│   ├── favicon.ico
│   ├── (auth)/                    Public routes — no auth required
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   └── (dashboard)/               Protected routes — wrapped in sidebar shell + AuthGuard
│       ├── layout.tsx             Sidebar shell + AuthGuard + role-based nav
│       ├── overview/page.tsx
│       ├── logs/
│       │   ├── page.tsx           Workout log list / athlete dashboard
│       │   ├── new/page.tsx       Start a free session
│       │   ├── history/page.tsx   Full session history
│       │   └── [sessionId]/
│       │       ├── page.tsx       Active session recorder
│       │       └── summary/page.tsx
│       ├── training/page.tsx      Program builder (trainer/admin) + program view (athlete)
│       ├── athletes/page.tsx      Trainer: their athletes · Admin: all org athletes
│       ├── trainers/page.tsx      Admin: all org trainers
│       ├── analytics/page.tsx     Progression charts
│       ├── health/page.tsx        Athlete profile + body measurements
│       └── settings/page.tsx      Org settings / personal profile
│
├── components/
│   ├── ui/                        shadcn/ui — auto-generated, NEVER hand-edit
│   │   ├── alert.tsx              pnpx shadcn add <name> to add new primitives
│   │   ├── alert-dialog.tsx
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── skeleton.tsx
│   │   ├── tabs.tsx
│   │   └── textarea.tsx
│   ├── auth/                      Authentication forms
│   │   ├── login-form.tsx
│   │   └── register-form.tsx
│   ├── charts/                    Chart wrappers (Recharts / Nivo)
│   │   ├── body-measurement-chart.tsx
│   │   ├── exercise-progression-chart.tsx
│   │   └── weekly-volume-chart.tsx
│   └── layout/                    Shell components used across all pages
│       ├── auth-guard.tsx         Redirects to /login if unauthenticated
│       ├── can.tsx                Role-gate wrapper — <Can role="trainer">…</Can>
│       ├── invite-banner.tsx      Pending invite notification strip
│       ├── mobile-nav.tsx         Bottom-sheet nav for mobile viewports
│       └── sidebar.tsx            Desktop left sidebar
│
├── hooks/                         TanStack Query — one hook per API operation
│   ├── use-login.ts
│   ├── use-logout.ts
│   ├── use-register.ts
│   ├── use-role.ts                Reads role from Zustand auth store
│   ├── analytics/
│   │   └── use-anamnesis.ts
│   ├── identity/
│   │   ├── use-invites.ts
│   │   ├── use-memberships.ts
│   │   ├── use-org-athletes.ts
│   │   └── use-settings.ts
│   ├── logs/
│   │   ├── use-active-session.ts
│   │   ├── use-discard-session.ts
│   │   ├── use-exercise-history.ts
│   │   ├── use-exercise-log.ts
│   │   ├── use-finish-session.ts
│   │   ├── use-log-set.ts
│   │   ├── use-multiple-exercise-history.ts
│   │   ├── use-progress-stats.ts
│   │   ├── use-session-history.ts
│   │   ├── use-session.ts
│   │   ├── use-start-session.ts
│   │   ├── use-update-session.ts
│   │   └── use-weekly-volume.ts
│   └── training/
│       ├── use-exercises.ts
│       └── use-programs.ts
│
├── lib/
│   ├── utils.ts                   cn() + shared helpers (formatDate, formatWeight…)
│   ├── api/                       Axios wrappers — one file per backend module
│   │   ├── client.ts              Single Axios instance + auth/refresh interceptors
│   │   ├── auth.ts
│   │   ├── analytics.ts
│   │   ├── identity.ts
│   │   ├── logs.ts
│   │   └── training.ts
│   ├── auth/
│   │   ├── store.ts               Zustand: accessToken + User (in-memory only)
│   │   └── token.ts               localStorage refresh-token helpers
│   └── i18n/
│       ├── index.ts               t() helper + locale loader
│       └── locales/
│           ├── en.ts
│           └── pt-BR.ts
│
├── providers/
│   ├── i18n-provider.tsx          Wraps app with i18n context
│   └── query-provider.tsx         TanStack QueryClientProvider
│
├── types/
│   └── api.ts                     TypeScript mirrors of backend Pydantic schemas
│
└── tests/
    ├── setup.ts                   Vitest global setup (MSW server, jest-dom)
    ├── components/
    │   └── layout/
    │       ├── auth-guard.test.tsx
    │       └── can.test.tsx
    ├── hooks/
    │   ├── use-logout.test.tsx
    │   └── use-role.test.ts
    └── lib/
        └── auth/
            └── token.test.ts
```

### Where things go

| What you're adding | Where it lives |
|---|---|
| New dashboard page | `app/(dashboard)/<section>/page.tsx` |
| New auth page | `app/(auth)/<name>/page.tsx` |
| shadcn/ui primitive | `components/ui/` via `pnpx shadcn add` — never hand-edit |
| Feature component (1 domain) | `components/<domain>/<name>.tsx` |
| Shell / layout component | `components/layout/` |
| Chart | `components/charts/` |
| Query or mutation hook | `hooks/<domain>/use-<resource>.ts` |
| Auth hook (login, logout…) | `hooks/use-<action>.ts` |
| API function | `lib/api/<module>.ts` using the client from `lib/api/client.ts` |
| Locale string | `lib/i18n/locales/en.ts` **and** `pt-BR.ts` — always both |
| New backend type | `types/api.ts` — mirror the Pydantic schema exactly |
| Provider / context | `providers/<name>-provider.tsx`, mounted in `app/layout.tsx` |
| Component test | `tests/components/<domain>/<name>.test.tsx` |
| Hook test | `tests/hooks/use-<name>.test.ts` |

## Testing
- Unit test hooks and API functions with Vitest + MSW for API mocking.
- Use Testing Library for component tests.
- Critical paths: login success, login error, token refresh, role-gated redirect.
