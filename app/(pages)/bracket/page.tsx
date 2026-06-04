'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface BracketMatch {
  id: string
  stage: string
  kickoff_utc: string
  homeName: string
  awayName: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'finished'
}

const STAGE_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL']

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
        <p className="muted">Round of 32 through the final</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="bracket-grid">
        {STAGE_ORDER.map((stage) => (
          <article key={stage} className="card">
            <h2 className="subhead">{stage === 'THIRD_PLACE' ? 'Third Place' : stage}</h2>
            <div className="mini-table">
              {(grouped.get(stage) ?? []).map((match) => (
                <p key={match.id}>
                  {match.homeName} {match.home_score ?? '-'} - {match.away_score ?? '-'} {match.awayName}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
