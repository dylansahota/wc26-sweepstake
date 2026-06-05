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

  const stageSummaries = useMemo(() => {
    return STAGE_ORDER.map((stage) => {
      const stageMatches = grouped.get(stage) ?? []
      return {
        stage,
        total: stageMatches.length,
        finished: stageMatches.filter((match) => match.status === 'finished').length,
      }
    })
  }, [grouped])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card bracket-hero">
        <div>
          <h1 className="title">Knockout Bracket</h1>
          <p className="muted">Route labels stay visible until qualified teams are known, so picks are still easy before groups finish.</p>
        </div>
        <div className="stage-summary-grid">
          {stageSummaries.map((summary) => (
            <div key={summary.stage} className="stage-summary-card">
              <span className="stage-summary-label">{STAGE_LABELS[summary.stage]}</span>
              <strong>{summary.finished}/{summary.total}</strong>
              <span className="muted">matches finished</span>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="bracket-grid">
        {STAGE_ORDER.map((stage) => (
          <article key={stage} className="card bracket-stage-card">
            <div className="row split bracket-stage-head">
              <h2 className="subhead">{STAGE_LABELS[stage]}</h2>
              <span className="pill">{(grouped.get(stage) ?? []).length} ties</span>
            </div>
            <div className="mini-table">
              {(grouped.get(stage) ?? []).map((match) => (
                <div key={match.id} className="bracket-match">
                  {(() => {
                    const hasScore = match.home_score != null || match.away_score != null
                    const routeOnly = Boolean(match.homeRoute && match.awayRoute)
                    const isDuplicateRouteText =
                      routeOnly &&
                      match.homeName === match.homeRoute &&
                      match.awayName === match.awayRoute &&
                      !hasScore

                    return (
                      <>
                  <div className="row split bracket-meta">
                    {match.matchLabel ? <p className="bracket-match-label">{match.matchLabel}</p> : <span />}
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
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
