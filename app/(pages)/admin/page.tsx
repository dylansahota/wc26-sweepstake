'use client'

import { useEffect, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface MatchItem {
  id: string
  stage: string
  group_name: string | null
  kickoff_utc: string
  home_team_id: string | null
  away_team_id: string | null
  home_placeholder: string | null
  away_placeholder: string | null
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
  homeTeam?: { id: string; name: string; code: string | null } | null
  awayTeam?: { id: string; name: string; code: string | null } | null
}

export default function AdminPage() {
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [status, setStatus] = useState<'scheduled' | 'finished'>('finished')
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch('/api/matches', { cache: 'no-store' })
    const payload = (await res.json()) as { matches?: MatchItem[]; error?: string }
    if (!res.ok || !payload.matches) {
      setMessage(payload.error ?? 'Failed to load matches')
      return
    }
    setMatches(payload.matches)
    setMessage('')
  }

  useEffect(() => {
    const initial = setTimeout(() => {
      void load()
    }, 0)
    return () => clearTimeout(initial)
  }, [])

  function onSelectMatch(matchId: string) {
    setSelectedMatchId(matchId)
    const match = matches.find((item) => item.id === matchId)
    setHomeScore(match?.home_score != null ? String(match.home_score) : '')
    setAwayScore(match?.away_score != null ? String(match.away_score) : '')
    setStatus(match?.status ?? 'finished')
  }

  async function save() {
    if (!selectedMatchId) {
      setMessage('Pick a match first')
      return
    }
    const res = await fetch('/api/matches', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        matchId: selectedMatchId,
        homeScore: homeScore === '' ? null : Number(homeScore),
        awayScore: awayScore === '' ? null : Number(awayScore),
        status,
      }),
    })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok) {
      setMessage(payload.error ?? 'Failed to save')
      return
    }
    setMessage('Saved')
    await load()
  }

  async function resetForTesting() {
    const confirmed = window.confirm(
      'Reset all draft picks, draft order, match scores, and calculated team progress for testing?'
    )
    if (!confirmed) return

    const res = await fetch('/api/admin/reset', {
      method: 'POST',
    })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok) {
      setMessage(payload.error ?? 'Reset failed')
      return
    }

    setSelectedMatchId('')
    setHomeScore('')
    setAwayScore('')
    setStatus('finished')
    setMessage('Reset complete')
    await load()
  }

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Results Admin (Dylan Only)</h1>
        <p className="muted">Enter per-match scores. Team progression and points recalculate automatically.</p>
      </section>

      <section className="card">
        <label className="field-label">Match</label>
        <select className="field" value={selectedMatchId} onChange={(e) => onSelectMatch(e.target.value)}>
          <option value="">Select a match...</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.homeTeam?.name ?? match.home_placeholder ?? 'TBD'} vs {match.awayTeam?.name ?? match.away_placeholder ?? 'TBD'} ({match.stage})
            </option>
          ))}
        </select>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            Home score
            <input
              className="field"
              type="number"
              min={0}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
            />
          </label>
          <label>
            Away score
            <input
              className="field"
              type="number"
              min={0}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
            />
          </label>
          <label>
            Status
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as 'scheduled' | 'finished')}>
              <option value="scheduled">scheduled</option>
              <option value="finished">finished</option>
            </select>
          </label>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary-btn" type="button" onClick={save}>
            Save Match Result
          </button>
          <button className="ghost-btn" type="button" onClick={load}>
            Reload
          </button>
          <button className="ghost-btn" type="button" onClick={resetForTesting}>
            Reset Testing Data
          </button>
        </div>

        {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  )
}
