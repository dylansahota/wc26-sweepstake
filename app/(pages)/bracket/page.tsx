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
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function MatchCard({ match }: { match: BracketMatch }) {
  const hasScore = match.home_score != null || match.away_score != null
  const routeOnly = Boolean(match.homeRoute && match.awayRoute)
  const isDuplicateRouteText =
    routeOnly &&
    match.homeName === match.homeRoute &&
    match.awayName === match.awayRoute &&
    !hasScore

  return (
    <div className="bracket-match">
      <div className="row split bracket-meta">
        {match.matchLabel ? (
          <p className="bracket-match-label">{match.matchLabel}</p>
        ) : (
          <span />
        )}
        <span className={`fixture-status ${match.status}`}>{match.status}</span>
      </div>
      {match.homeRoute || match.awayRoute ? (
        <p className="bracket-route">
          {match.homeRoute ?? match.homeName} vs {match.awayRoute ?? match.awayName}
        </p>
      ) : null}
      <p className="muted bracket-kickoff">{formatKickoff(match.kickoff_utc)}</p>
      {!isDuplicateRouteText ? (
        <p className="bracket-scoreline">
          <span className="bracket-team-name">{match.homeName}</span>
          <span className="bracket-score-value">
            {match.home_score ?? '-'} - {match.away_score ?? '-'}
          </span>
          <span className="bracket-team-name">{match.awayName}</span>
        </p>
      ) : null}
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
    const initial = setTimeout(() => {
      void load()
    }, 0)
    const interval = setInterval(load, 12000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
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
        <p className="muted">Route labels show qualifying paths until teams are confirmed.</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="bracket-grid">
        {STAGE_ORDER.map((stage) => (
          <article key={stage} className="card bracket-stage-card">
            <div className="row split bracket-stage-head">
              <h2 className="subhead">{STAGE_LABELS[stage]}</h2>
            </div>
            <div className="mini-table">
              {(grouped.get(stage) ?? []).map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
