# WC26 Sweepstake

World Cup 2026 snake draft sweepstake app for 5 players.

## Features

- PIN login with httpOnly JWT session cookie
- Live snake draft board (9 rounds, 45 picks)
- Team rosters with tier tags
- Official FIFA squad scouting on the draft board
- Multiplier leaderboard (base points x tier multiplier)
- Admin results entry that auto-updates scoring

## Stack

- Next.js 16 App Router + TypeScript
- Supabase Postgres
- Custom JWT auth (`bcryptjs` + `jose`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add env vars in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

3. Run SQL in Supabase SQL editor:

- `supabase/schema.sql`

4. Seed data:

```bash
npm run seed:players
npm run seed:teams
npm run seed:fixtures
npx playwright install chromium
npm run seed:squads
```

Optional: provide custom player names before seeding:

```bash
SWEEPSTAKE_PLAYERS="Alice,Bob,Chris,Dani,Eli"
```

5. Start app:

```bash
npm run dev
```

## Routes

- `/` login
- `/draft` draft board + rosters
- `/draft` also shows ranking, group, and official FIFA squad scouting for each team
- `/leaderboard` live scores + breakdown
- `/bracket` knockout bracket view
- `/admin` results entry

## Scoring

- Group win: +4
- Group draw: +2
- R32: +4
- R16: +5
- QF: +7
- SF: +9
- Final: +11
- Champion: +15

Tier multipliers:

- Tier 1 = x1.0
- Tier 2 = x1.5
- Tier 3 = x2.0
