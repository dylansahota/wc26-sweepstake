'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface BracketMatch {
  id: string
  stage: string
  kickoff_utc: string
  matchLabel?: string
  homeRoute?: string
  awayRoute?: string
  homeName: string
  awayName: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
}

const STAGE_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL']
const STAGE_LABELS: Record<string, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

function formatKickoff(value: string) {
  const date = new Date(value)
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

function TeamSlot({ name, route, align }: {
  name: string
  route?: string
  align: 'left' | 'right'
}) {
  const confirmed = !route || name !== route
  return (
    <div className={`bracket-team-slot bracket-team-slot--${align}`}>
      {confirmed ? (
        <span className="bracket-team-slot-name">{name}</span>
      ) : (
        <span className="bracket-team-slot-tbd" style={{ textAlign: align }}>
          {route ?? 'TBD'}
        </span>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: BracketMatch }) {
  const finished = match.status === 'finished'
  const hasScore = match.home_score != null && match.away_score != null

  return (
    <div className="bracket-match">
      <div className="bracket-match-header">
        <span className="bracket-match-label">{match.matchLabel ?? ''}</span>
        <span className="bracket-kickoff">{formatKickoff(match.kickoff_utc)}</span>
      </div>
      <div className="bracket-matchup">
        <TeamSlot name={match.homeName} route={match.homeRoute} align="left" />
        <div className="bracket-score-block">
          {finished && hasScore ? (
            <span className="bracket-score-value">
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span className="bracket-vs">vs</span>
          )}
        </div>
        <TeamSlot name={match.awayName} route={match.awayRoute} align="right" />
      </div>
    </div>
  )
}

export default function BracketPage() {
  const [matches, setMatches] = useState<BracketMatch[]>([])
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/bracket', { cache: 'no-store' })
    const payload = (await res.json()) as { bracket?: BracketMatch[]; error?: string }
    if (!res.ok || !payload.bracket) {
      setError(payload.error ?? 'Failed to load bracket')
      return
    }
    setMatches(payload.bracket)
    setError('')
  }

  useEffect(() => {
    const initial = setTimeout(() => { void load() }, 0)
    const interval = setInterval(load, 12000)
    return () => { clearTimeout(initial); clearInterval(interval) }
  }, [])

  const grouped = useMemo(() => {
    const byStage = new Map<string, BracketMatch[]>()
    for (const stage of STAGE_ORDER) byStage.set(stage, [])
    for (const match of matches) {
      const list = byStage.get(match.stage) ?? []
      list.push(match)
      byStage.set(match.stage, list)
    }
    return byStage
  }, [matches])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Knockout Bracket</h1>
        <p className="muted">Teams fill in as groups complete · updates on every sync</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="bracket-grid">
        {STAGE_ORDER.map((stage) => {
          const stageMatches = grouped.get(stage) ?? []
          if (stageMatches.length === 0) return null
          return (
            <div key={stage} className="bracket-round-card">
              <p className="bracket-round-label">{STAGE_LABELS[stage]}</p>
              <div className={stage === 'R32' ? 'bracket-matches-r32' : 'bracket-matches-list'}>
                {stageMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
