'use client'

import NavBar from '@/app/components/NavBar'
import { THIRD_PLACE_WIN_BASE_POINTS } from '@/lib/scoring'

const SCORING_ROWS = [
  { event: 'Group win', base: 4 },
  { event: 'Group draw', base: 2 },
  { event: 'Qualify for Round of 32', base: 4 },
  { event: 'Reach Round of 16', base: 5 },
  { event: 'Reach Quarter-final', base: 7 },
  { event: 'Reach Semi-final', base: 9 },
  { event: 'Reach Final', base: 11 },
  { event: 'Win Tournament', base: 15 },
  { event: 'Win third-place playoff', base: THIRD_PLACE_WIN_BASE_POINTS },
]

const MULTIPLIER_ROWS = [
  { tier: 'Tier 1 team', multiplier: 'x1' },
  { tier: 'Tier 2 team', multiplier: 'x1.5' },
  { tier: 'Tier 3 team', multiplier: 'x2' },
]

export default function PointsPage() {
  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">How Points Work</h1>
        <p className="muted">Each team earns base points from results and progression. The drafted team tier multiplier is then applied to get your actual sweepstake points.</p>
      </section>

      <section className="two-col-grid">
        <article className="card">
          <h2 className="subhead">Base Points</h2>
          <div className="mini-table points-table">
            {SCORING_ROWS.map((row) => (
              <div key={row.event} className="points-row">
                <span>{row.event}</span>
                <strong>+{row.base}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h2 className="subhead">Tier Multipliers</h2>
          <div className="mini-table points-table">
            {MULTIPLIER_ROWS.map((row) => (
              <div key={row.tier} className="points-row">
                <span>{row.tier}</span>
                <strong>{row.multiplier}</strong>
              </div>
            ))}
          </div>
          <p className="muted points-note">
            Example: a Tier 3 team with +9 base points from a stage jump gives +18 to the owning player.
          </p>
        </article>
      </section>

      <section className="card">
        <h2 className="subhead">Tournament Notes</h2>
        <ul className="points-notes-list muted">
          <li>Group-stage match results update points as soon as results sync and progress recalculates.</li>
          <li>Knockout progression points are awarded when teams are marked as having reached that round.</li>
          <li>The third-place match now gives a standalone +2 base points to the winner only.</li>
        </ul>
      </section>
    </main>
  )
}
