# WC2026 Sweepstake — Design Context

## Stack
- **Next.js 16.2.7** (App Router, Turbopack) — note: breaking API changes vs older Next.js; always read `node_modules/next/dist/docs/` before editing
- **React 19**, **TypeScript 5**, no Tailwind/Bootstrap — vanilla CSS only
- **Supabase** (PostgreSQL) for all data; accessed via `@supabase/supabase-js`
- **Chart.js + react-chartjs-2** for score progression line chart
- **jose** for JWT verification (not jsonwebtoken)
- **bcryptjs** for PIN hashing
- Deployed on **Vercel** under the `pl-predictor` team

## Auth
- Cookie-based JWT: cookie name `wc26sw_session`
- Auth middleware lives in `proxy.ts` (not `middleware.ts`). Protected routes: `/draft`, `/leaderboard`, `/bracket`, `/admin`
- Admin check: `payload.name.trim().toLowerCase() === 'dylan'`
- Non-admin hitting `/admin` redirects to `/leaderboard`
- Post-login and session-detected redirects both go to `/leaderboard` (changed from `/draft`)
- Login page uses `min-height: 100dvh` (dynamic viewport) so it fits correctly on mobile without scroll

## Game Rules / Scoring
- **5 players, 9 snake-draft rounds = 45 total picks**
- **Tier multipliers**: T1 = 1×, T2 = 1.5×, T3 = 2× — defined in `lib/domain.ts`
- Tier 1 teams (8): France, Argentina, Spain, England, Portugal, Brazil, Morocco, Netherlands
- Tier 2 teams (20): Belgium, Germany, Croatia, Colombia, Senegal, Mexico, USA, Uruguay, Japan, Switzerland, Iran, Turkey, Austria, Ecuador, South Korea, Australia, Algeria, Egypt, Canada, Norway
- Everything else = Tier 3
- Matchday date keys use `America/New_York` timezone (ET) to avoid day-boundary issues since all WC2026 games are US-based
- Chart baseline injected at `2026-06-10` with 0 points so the chart starts flat before the first game (11 Jun)
- Score progression chart uses solid lines only (no `borderDash`)

## CSS Architecture
All styling is in `app/globals.css`. Key conventions:

- **CSS custom properties** (`:root`): dark charcoal palette — `--bg: #0a0a12`, `--card: #14141e`, `--accent: #f7b538` (gold), `--teal: #22d3ee`
- Background: multi-layer radial gradient (subtle amber + purple glows)
- **No utility classes** — each component has semantic class names
- Group standings table: `standings-header` / `standings-row` — 9-column CSS Grid (`minmax(0,1fr) repeat(8, minmax(28px,28px))`)
- Best-third table **reuses** `standings-header`/`standings-row` but overrides to 6-column grid inside `.best-third-table`
- **Critical mobile fix**: at ≤479px, columns 6/7/8 (GF/GA/GD) are hidden — but this rule is **scoped to `.groups-grid`** only. Without the scope, the identical selector would also hide column 6 of the best-third table, which is Pts (the most important column)
- Mobile breakpoints: `≤479px` (phones portrait), `≤767px` (mobile — bottom tab bar shows), `≤959px` (tablet), `≥960px` (desktop two-column layouts)

## Navigation
- **Desktop** (`≥768px`): top nav bar (`.nav-desktop-only`), links as pill buttons, active = amber border
- **Mobile** (`≤767px`): fixed bottom tab bar (`.bottom-tab-bar`) with 5 tabs: Draft, Standings, Groups, Bracket, Results — plus a "More" button
- "More" opens a bottom sheet (`.more-menu`) with Points, Admin (admin only), Logout
- Admin tab only shows if session name === 'dylan' — checked client-side via `/api/auth/session`
- Nav component: `app/components/NavBar.tsx`

## Pages

### Draft (`app/(pages)/draft/page.tsx`)
- "On the clock" banner shows current player name in their colour
- Available teams list with search + group filter + tier filter
- Each team card has **Squad** (inline expand) and **Group** (inline expand showing all group teams) toggle buttons
- Clicking "Draft" opens a **confirmation modal** (centered overlay); after confirm → scrolls to top
- Draft complete state shows trophy message
- Polls `/api/draft` every 7s

### Leaderboard (`app/(pages)/leaderboard/page.tsx`)
- 3 sections: player cards (gold/silver/bronze rank badges + colour bar), Score Progression chart, Team Points Table
- Chart starts from `2026-06-10` baseline; polls every 10s
- Team points table columns: Team / Owner / Tier / Points
- On mobile (`≤767px`) the Tier column (`.tp-stage-col`) is hidden

### Groups (`app/(pages)/groups/page.tsx`)
- 12 group cards in auto-fill grid; clicking a row opens a slide-in details drawer from the right
- Search input highlights matches (dims non-matches, accent background on matches) — it highlights, does not filter
- Best-third placed table below all groups; top 8 rows have teal qualify-zone styling
- Polls every 30s

### Bracket (`app/(pages)/bracket/page.tsx`)
- Each match is a `.bracket-match` card with amber label, scoreline, and kickoff time

### Admin (`app/(pages)/admin/page.tsx`)
- Stripped to single "Sync Results" button only
- Calls `POST /api/matches/sync`

### Points (`app/(pages)/points/page.tsx`)
- Static explainer page; tier multipliers shown as x1 / x1.5 / x2

## API Routes (`app/api/`)
| Route | Method | Purpose |
|---|---|---|
| `/api/auth` | POST / DELETE | Login / logout |
| `/api/auth/session` | GET | Returns current session payload |
| `/api/draft` | GET | Full draft state |
| `/api/draft/pick` | POST | Submit a pick for the current player |
| `/api/draft/start` | POST | Start draft; accepts optional `order` array of player IDs |
| `/api/groups` | GET | All group standings |
| `/api/leaderboard` | GET | Player scores with team breakdown |
| `/api/score-history` | GET | Dates + player series + team series for chart |
| `/api/matches/sync` | POST | Admin: pull from football-data API, recalc standings |
| `/api/match-history` | GET | Per-match point impact history |
| `/api/results` | GET | Results feed |
| `/api/teams` | GET | Teams list |
| `/api/admin/remove-pick` | POST | Admin: delete a draft pick by ID |

## Key Lib Files
- `lib/domain.ts` — tier lists, multipliers, snake order builder
- `lib/history.ts` — `buildScoringHistory()` — replays all match results to compute per-day player totals; uses ET timezone for date keys
- `lib/scoring.ts` — `calculateBasePoints()`, `buildThirdPlaceBonusByTeam()`
- `lib/progress.ts` — `applyMatchToProgress()`, `TeamProgressState`, `emptyProgress()`
- `lib/team-names.ts` — `normalizeTeamName()` for fuzzy tier lookup

## Deployment
- Vercel project ID: `prj_iBen2wQiK81cvoJFglRrYyJVLZ9S` under `pl-predictor` team
- Framework must be set to `nextjs` in Vercel project settings (was blank initially, caused 404s)
- Vercel Authentication must be **disabled** (Settings → Deployment Protection)
- Env vars needed: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `JWT_SECRET`
- Auto-deploys on push to `main`

## Onboarding to a New Machine
```bash
git clone https://github.com/dylansahota/wc26-sweepstake.git
cd wc26-sweepstake
npm install
vercel link   # link to existing pl-predictor/wc26-sweepstake project
vercel env pull .env.local
npm run dev
```
