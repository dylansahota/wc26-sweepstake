'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface MatchHistoryTeamImpact {
  teamId: string
  teamName: string
  ownerId: string | null
  ownerName: string | null
  ownerColour: string | null
  tier: 1 | 2 | 3 | null
  multiplier: number | null
  baseDelta: number
  pointsDelta: number
}

interface MatchHistoryPlayerImpact {
  playerId: string
  name: string
  colour: string
  pointsDelta: number
  teams: Array<{
    teamId: string
    teamName: string
    baseDelta: number
    pointsDelta: number
    multiplier: number
  }>
}

interface MatchHistoryEntry {
  id: string
  kickoffUtc: string
  date: string
  stage: string
  groupName: string | null
  homeTeamName: string | null
  awayTeamName: string | null
  homeScore: number | null
  awayScore: number | null
  teamImpacts: MatchHistoryTeamImpact[]
  playerImpacts: MatchHistoryPlayerImpact[]
}

export default function ResultsPage() {
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const response = await fetch('/api/match-history', { cache: 'no-store' })
      const payload = (await response.json()) as { matches?: MatchHistoryEntry[]; error?: string }

      if (!active) return

      if (!response.ok || !payload.matches) {
        setError(payload.error ?? 'Failed to load results history')
        return
      }

      setMatches(payload.matches)
      setError('')
    }

    void load()
    const interval = setInterval(load, 15000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, MatchHistoryEntry[]>()
    for (const match of matches) {
      const existing = groups.get(match.date) ?? []
      existing.push(match)
      groups.set(match.date, existing)
    }
    return Array.from(groups.entries()).sort((left, right) => right[0].localeCompare(left[0]))
  }, [matches])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Results and Match Points</h1>
        <p className="muted">Every finished match, plus the sweepstake points each team and player gained from it.</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {groupedMatches.length === 0 ? (
        <section className="card">
          <p className="muted">No finished matches yet.</p>
        </section>
      ) : (
        groupedMatches.map(([date, items]) => (
          <section key={date} className="results-group">
            <div className="results-date">{date}</div>
            <div className="results-list">
              {items.map((match) => (
                <article key={match.id} className="card result-card">
                  <div className="row split result-header">
                    <div>
                      <h2 className="subhead">
                        {match.homeTeamName ?? 'TBD'} {match.homeScore ?? '-'} - {match.awayScore ?? '-'} {match.awayTeamName ?? 'TBD'}
                      </h2>
                      <p className="muted">
                        {match.stage === 'GROUP' && match.groupName ? `Group ${match.groupName}` : match.stage} ·{' '}
                        {new Date(match.kickoffUtc).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="result-columns">
                    <section className="result-panel">
                      <h3>Team Points</h3>
                      <div className="impact-list">
                        {match.teamImpacts.map((impact) => (
                          <div key={impact.teamId} className="impact-row">
                            <div>
                              <strong>{impact.teamName}</strong>
                              <p className="muted impact-meta">
                                {impact.ownerName ? `${impact.ownerName} · T${impact.tier ?? '-'} x ${impact.multiplier ?? '-'}` : 'Undrafted team'}
                              </p>
                            </div>
                            <strong>{impact.pointsDelta >= 0 ? `+${impact.pointsDelta}` : impact.pointsDelta} pts</strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="result-panel">
                      <h3>Player Points</h3>
                      {match.playerImpacts.length === 0 ? (
                        <p className="muted">No drafted teams picked up points from this match.</p>
                      ) : (
                        <div className="impact-list">
                          {match.playerImpacts.map((impact) => (
                            <div key={impact.playerId} className="impact-row player-impact-row">
                              <div>
                                <strong style={{ color: impact.colour }}>{impact.name}</strong>
                                <p className="muted impact-meta">
                                  {impact.teams
                                    .map((team) => `${team.teamName} (${team.baseDelta >= 0 ? `+${team.baseDelta}` : team.baseDelta} base)`)
                                    .join(' · ')}
                                </p>
                              </div>
                              <strong>{impact.pointsDelta >= 0 ? `+${impact.pointsDelta}` : impact.pointsDelta} pts</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
