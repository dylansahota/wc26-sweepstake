'use client'

import { useState } from 'react'
import NavBar from '@/app/components/NavBar'

export default function AdminPage() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function syncResults() {
    setBusy(true)
    const res = await fetch('/api/matches/sync', { method: 'POST' })
    const payload = (await res.json()) as { error?: string; syncedMatches?: number }
    setBusy(false)
    if (!res.ok) { setMessage(payload.error ?? 'Sync failed'); return }
    setMessage(`Synced ${payload.syncedMatches ?? 0} matches and recalculated standings.`)
  }

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Admin — Dylan Only</h1>
      </section>

      <section className="card">
        <h2 className="subhead">Sync Results</h2>
        <p className="muted">Pulls the latest World Cup scores from football-data and recalculates all team and player totals.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary-btn" type="button" onClick={syncResults} disabled={busy}>
            {busy ? 'Syncing…' : 'Sync results'}
          </button>
        </div>
        {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  )
}
