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

    if (!res.ok) {
      setMessage(payload.error ?? 'Sync failed')
      return
    }

    setMessage(`Synced ${payload.syncedMatches ?? 0} football-data matches and recalculated standings.`)
  }

  async function resetForTesting() {
    const confirmed = window.confirm(
      'Reset all draft picks, draft order, match scores, and calculated team progress for testing?'
    )
    if (!confirmed) return

    setBusy(true)

    const res = await fetch('/api/admin/reset', {
      method: 'POST',
    })
    const payload = (await res.json()) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setMessage(payload.error ?? 'Reset failed')
      return
    }

    setMessage('Reset complete')
  }

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Results Admin (Dylan Only)</h1>
        <p className="muted">Live scores should come from football-data. Manual match entry is no longer part of the normal flow.</p>
      </section>

      <section className="card">
        <h2 className="subhead">Data Controls</h2>
        <p className="muted">Use sync to pull the latest World Cup fixtures and scores, then recalculate all team and player totals.</p>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary-btn" type="button" onClick={syncResults} disabled={busy}>
            Sync football-data results
          </button>
          <button className="ghost-btn" type="button" onClick={resetForTesting} disabled={busy}>
            Reset Testing Data
          </button>
        </div>

        {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
      </section>
    </main>
  )
}
