'use client'

import { useEffect, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface Player {
  id: string
  name: string
  colour: string
}

interface DraftPick {
  id: string
  overall_pick: number
  player_id: string
  team_id: string
  players?: { name: string; colour: string } | null
  teams?: { name: string; tier: 1 | 2 | 3; groupName: string | null } | null
}

interface DraftData {
  players: Player[]
  picks: DraftPick[]
}

export default function AdminPage() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [pickPositions, setPickPositions] = useState<Record<string, number>>({})
  const [orderMessage, setOrderMessage] = useState('')
  const [orderBusy, setOrderBusy] = useState(false)
  const [removeBusy, setRemoveBusy] = useState<string | null>(null)

  async function loadDraft() {
    const res = await fetch('/api/draft', { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as DraftData
    setDraftData(data)
    const fetched = data.players ?? []
    setPlayers(fetched)
    setPickPositions((prev) => {
      const next: Record<string, number> = {}
      fetched.forEach((p, i) => {
        next[p.id] = prev[p.id] ?? i + 1
      })
      return next
    })
  }

  useEffect(() => { void loadDraft() }, [])

  async function syncResults() {
    setBusy(true)
    const res = await fetch('/api/matches/sync', { method: 'POST' })
    const payload = (await res.json()) as { error?: string; syncedMatches?: number }
    setBusy(false)
    if (!res.ok) { setMessage(payload.error ?? 'Sync failed'); return }
    setMessage(`Synced ${payload.syncedMatches ?? 0} matches and recalculated standings.`)
  }

  async function resetForTesting() {
    const confirmed = window.confirm(
      'Reset all draft picks, draft order, match scores, and calculated team progress for testing?',
    )
    if (!confirmed) return
    setBusy(true)
    const res = await fetch('/api/admin/reset', { method: 'POST' })
    const payload = (await res.json()) as { error?: string }
    setBusy(false)
    if (!res.ok) { setMessage(payload.error ?? 'Reset failed'); return }
    setMessage('Reset complete')
    void loadDraft()
  }

  async function setDraftOrder() {
    const n = players.length
    if (n === 0) return
    const positions = players.map((p) => pickPositions[p.id])
    if (!positions.every((pos) => Number.isInteger(pos) && pos >= 1 && pos <= n)) {
      setOrderMessage(`All positions must be whole numbers between 1 and ${n}.`)
      return
    }
    if (new Set(positions).size !== n) {
      setOrderMessage('All positions must be unique.')
      return
    }
    const orderedPlayerIds = [...players]
      .sort((a, b) => (pickPositions[a.id] ?? 0) - (pickPositions[b.id] ?? 0))
      .map((p) => p.id)

    setOrderBusy(true)
    setOrderMessage('')
    const res = await fetch('/api/draft/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedPlayerIds }),
    })
    const payload = (await res.json()) as { error?: string }
    setOrderBusy(false)
    if (!res.ok) { setOrderMessage(payload.error ?? 'Failed to set order.'); return }
    setOrderMessage('Draft pick order set successfully.')
  }

  async function removePick(pickId: string) {
    setRemoveBusy(pickId)
    const res = await fetch('/api/admin/remove-pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickId }),
    })
    setRemoveBusy(null)
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string }
      setMessage(payload.error ?? 'Failed to remove pick')
      return
    }
    void loadDraft()
  }

  const picksByPlayer = players.map((p) => ({
    ...p,
    picks: (draftData?.picks ?? [])
      .filter((pick) => pick.player_id === p.id)
      .sort((a, b) => a.overall_pick - b.overall_pick),
  }))

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Admin — Dylan Only</h1>
      </section>

      {/* Draft pick management */}
      <section className="card">
        <h2 className="subhead">Draft Picks</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Remove a pick if a mistake was made. The player can then re-draft.
        </p>
        {picksByPlayer.every((p) => p.picks.length === 0) ? (
          <p className="muted">No picks made yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {picksByPlayer.map((player) =>
              player.picks.length === 0 ? null : (
                <div key={player.id}>
                  <p style={{ color: player.colour, fontWeight: 700, marginBottom: 8 }}>
                    {player.name}
                  </p>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {player.picks.map((pick) => (
                      <div
                        key={pick.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: '#111118',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>
                          <span className="muted">#{pick.overall_pick} </span>
                          <strong>{pick.teams?.name ?? 'Unknown'}</strong>
                          {pick.teams && (
                            <span className="muted">
                              {' · '}Group {pick.teams.groupName ?? 'TBD'}{' · '}T{pick.teams.tier}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="ghost-btn"
                          style={{ fontSize: '0.8rem', padding: '5px 10px', color: 'var(--danger)', borderColor: '#ff6b6b44' }}
                          disabled={removeBusy === pick.id}
                          onClick={() => removePick(pick.id)}
                        >
                          {removeBusy === pick.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        {message ? <p className="muted" style={{ marginTop: 12, color: 'var(--danger)' }}>{message}</p> : null}
      </section>

      {/* Pick order */}
      <section className="card">
        <h2 className="subhead">Set Draft Pick Order</h2>
        <p className="muted">
          Assign a position (1–{players.length || 'N'}) to each player. The snake draft proceeds in this order.
        </p>
        {players.length > 0 ? (
          <>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontWeight: 600 }}>Player</div>
              <div className="muted" style={{ fontWeight: 600 }}>Position</div>
              {players.map((player) => (
                <>
                  <div key={`name-${player.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: player.colour,
                        flexShrink: 0,
                      }}
                    />
                    {player.name}
                  </div>
                  <input
                    key={`pos-${player.id}`}
                    className="field"
                    type="number"
                    min={1}
                    max={players.length}
                    value={pickPositions[player.id] ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setPickPositions((prev) => ({ ...prev, [player.id]: val }))
                    }}
                    style={{ width: 80 }}
                  />
                </>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="primary-btn" type="button" onClick={setDraftOrder} disabled={orderBusy}>
                Set Order
              </button>
            </div>
            {orderMessage ? <p className="muted" style={{ marginTop: 12 }}>{orderMessage}</p> : null}
          </>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>Loading players…</p>
        )}
      </section>

      {/* Data controls */}
      <section className="card">
        <h2 className="subhead">Data Controls</h2>
        <p className="muted">Sync pulls the latest World Cup scores and recalculates all totals.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary-btn" type="button" onClick={syncResults} disabled={busy}>
            Sync results
          </button>
          <button className="ghost-btn" type="button" onClick={resetForTesting} disabled={busy}>
            Reset Testing Data
          </button>
        </div>
      </section>
    </main>
  )
}
