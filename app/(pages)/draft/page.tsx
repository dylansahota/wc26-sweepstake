'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface Player {
  id: string
  name: string
  colour: string
}

interface Pick {
  id: string
  overall_pick: number
  round: number
  player_id: string
  team_id: string
  players?: { name: string; colour: string } | null
  teams?: { name: string; code: string | null; tier: 1 | 2 | 3; ranking: number | null; groupName: string | null } | null
}

interface Team {
  id: string
  name: string
  code: string | null
  tier: 1 | 2 | 3
  ranking: number | null
  groupName: string | null
  squad: Array<{
    id: string
    name: string
    position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD' | 'MANAGER'
    squad_role: 'player' | 'manager'
    shirt_number: number | null
  }>
}

interface DraftResponse {
  players: Player[]
  playerOrder: string[]
  picks: Pick[]
  teams: Team[]
  availableTeams: Team[]
  currentRound: number | null
  currentPlayerId: string | null
  maxPicks: number
  isComplete: boolean
}

export default function DraftPage() {
  const [data, setData] = useState<DraftResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  async function loadDraft() {
    const res = await fetch('/api/draft', { cache: 'no-store' })
    const payload = (await res.json()) as DraftResponse | { error: string }
    if (!res.ok) {
      setError('error' in payload ? payload.error : 'Failed to load draft')
      return
    }
    setData(payload as DraftResponse)
    setError('')
  }

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadDraft()
    }, 0)
    const interval = setInterval(loadDraft, 7000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  const playersById = useMemo(() => {
    return new Map((data?.players ?? []).map((p) => [p.id, p]))
  }, [data?.players])

  const rosters = useMemo(() => {
    if (!data) return []
    return data.players.map((player) => ({
      ...player,
      picks: data.picks.filter((pick) => pick.player_id === player.id),
    }))
  }, [data])

  const selectedTeam = useMemo(() => {
    if (!data) return null
    return data.teams.find((team) => team.id === selectedTeamId) ?? data.availableTeams[0] ?? data.teams[0] ?? null
  }, [data, selectedTeamId])

  const squadByPosition = useMemo(() => {
    const team = selectedTeam
    if (!team) return []

    const sections = [
      { label: 'Goalkeepers', key: 'GOALKEEPER' },
      { label: 'Defenders', key: 'DEFENDER' },
      { label: 'Midfielders', key: 'MIDFIELDER' },
      { label: 'Forwards', key: 'FORWARD' },
    ] as const

    return sections
      .map((section) => ({
        label: section.label,
        players: team.squad.filter(
          (member: Team['squad'][number]) => member.position === section.key && member.squad_role === 'player'
        ),
      }))
      .filter((section) => section.players.length > 0)
  }, [selectedTeam])

  const manager = useMemo(() => {
    return selectedTeam?.squad.find((member: Team['squad'][number]) => member.squad_role === 'manager') ?? null
  }, [selectedTeam])

  async function randomizeOrder() {
    setBusy(true)
    const res = await fetch('/api/draft/start', { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string }
      setError(payload.error ?? 'Failed to randomize order')
      return
    }
    await loadDraft()
  }

  async function makePick(teamId: string) {
    setBusy(true)
    const res = await fetch('/api/draft/pick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId }),
    })
    setBusy(false)
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string }
      setError(payload.error ?? 'Failed to submit pick')
      return
    }
    await loadDraft()
  }

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card split draft-hero">
        <div>
          <h1 className="title">WC26 Sweepstake Draft</h1>
          <p className="muted">Snake draft, 9 rounds, 45 picks total.</p>
          <p className="muted">Available teams are sorted by world ranking and show group placement when seeded fixtures include it.</p>
        </div>
        <div className="row">
          <button className="ghost-btn" type="button" onClick={randomizeOrder} disabled={busy}>
            Randomize Pick Order
          </button>
          <button className="primary-btn" type="button" onClick={loadDraft} disabled={busy}>
            Refresh
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="card">
        <h2 className="subhead">Draft State</h2>
        {!data ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            <p className="muted">
              Pick {data.picks.length + 1} / {data.maxPicks}
            </p>
            <p className="muted">
              Current round: {data.currentRound ?? 'Complete'} | On the clock:{' '}
              {data.currentPlayerId ? playersById.get(data.currentPlayerId)?.name ?? 'Unknown' : 'None'}
            </p>
          </>
        )}
      </section>

      <section className="two-col-grid draft-grid">
        <article className="card draft-available-card">
          <h2 className="subhead">Available Teams</h2>
          <div className="team-grid">
            {(data?.availableTeams ?? []).map((team) => (
              <div key={team.id} className={`team-card${selectedTeam?.id === team.id ? ' selected' : ''}`}>
                <span className="team-main">
                  <strong>{team.name}</strong>
                  <span className="team-meta">
                    <span>#{team.ranking ?? '-'}</span>
                    <span>{team.groupName ? `Group ${team.groupName}` : 'Group TBD'}</span>
                    <span>{team.code ?? 'N/A'}</span>
                  </span>
                </span>
                <span className="team-side">
                  <span className="tier">T{team.tier}</span>
                </span>
                <div className="team-actions">
                  <button type="button" className="ghost-btn" onClick={() => setSelectedTeamId(team.id)}>
                    Squad
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busy || data?.isComplete}
                    onClick={() => makePick(team.id)}
                  >
                    Draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card draft-scout-card">
          <h2 className="subhead">Team Scout</h2>
          {!selectedTeam ? (
            <p className="muted">Select a team to inspect its official FIFA squad.</p>
          ) : (
            <div className="scout-panel">
              <div className="row split scout-header">
                <div>
                  <h3>{selectedTeam.name}</h3>
                  <p className="muted">
                    #{selectedTeam.ranking ?? '-'} · {selectedTeam.groupName ? `Group ${selectedTeam.groupName}` : 'Group TBD'} · T{selectedTeam.tier}
                  </p>
                </div>
                <div className="scout-summary">
                  <span>
                    {selectedTeam.squad.filter((member: Team['squad'][number]) => member.squad_role === 'player').length} players
                  </span>
                  <span>{manager ? `Manager: ${manager.name}` : 'Manager TBD'}</span>
                </div>
              </div>
              <div className="squad-sections">
                {squadByPosition.length === 0 ? <p className="muted">No squad data seeded yet for this team.</p> : null}
                {squadByPosition.map((section) => (
                  <section key={section.label} className="squad-section">
                    <h4>{section.label}</h4>
                    <ul>
                      {section.players.map((member: Team['squad'][number]) => (
                        <li key={member.id}>
                          {member.shirt_number ? `${member.shirt_number}. ` : ''}
                          {member.name}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="card">
        <h2 className="subhead">Player Rosters</h2>
        <div className="roster-list">
          {rosters.map((player) => (
            <div key={player.id} className="roster-block">
              <h3 style={{ color: player.colour }}>{player.name}</h3>
              <ul>
                {player.picks.map((pick) => (
                  <li key={pick.id}>
                    #{pick.overall_pick} {pick.teams?.name ?? 'Unknown'}
                    {' '}
                    <span className="roster-meta">
                      #{pick.teams?.ranking ?? '-'}
                      {' · '}
                      {pick.teams?.groupName ? `Group ${pick.teams.groupName}` : 'Group TBD'}
                      {' · '}
                      T{pick.teams?.tier ?? 3}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </div>
      </section>
    </main>
  )
}
