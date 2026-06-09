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

const POSITION_SECTIONS = [
  { label: 'Goalkeepers', key: 'GOALKEEPER' },
  { label: 'Defenders', key: 'DEFENDER' },
  { label: 'Midfielders', key: 'MIDFIELDER' },
  { label: 'Forwards', key: 'FORWARD' },
] as const

export default function DraftPage() {
  const [data, setData] = useState<DraftResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [expandedSquadId, setExpandedSquadId] = useState<string | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [pendingPickTeam, setPendingPickTeam] = useState<Team | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [tierFilter, setTierFilter] = useState('ALL')

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
    const initial = setTimeout(() => { void loadDraft() }, 0)
    const interval = setInterval(loadDraft, 7000)
    return () => { clearTimeout(initial); clearInterval(interval) }
  }, [])

  const playersById = useMemo(
    () => new Map((data?.players ?? []).map((p) => [p.id, p])),
    [data?.players],
  )

  const rosters = useMemo(() => {
    if (!data) return []
    return data.players.map((player) => ({
      ...player,
      picks: data.picks.filter((pick) => pick.player_id === player.id),
    }))
  }, [data])

  const availableGroups = useMemo(() => {
    return Array.from(
      new Set(
        (data?.availableTeams ?? [])
          .map((team) => team.groupName)
          .filter((g): g is string => Boolean(g)),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [data?.availableTeams])

  const filteredAvailableTeams = useMemo(() => {
    const query = teamSearch.toLowerCase().trim()
    return (data?.availableTeams ?? []).filter((team) => {
      if (groupFilter !== 'ALL' && team.groupName !== groupFilter) return false
      if (tierFilter !== 'ALL' && String(team.tier) !== tierFilter) return false
      if (!query) return true
      return (
        team.name.toLowerCase().includes(query) ||
        team.code?.toLowerCase().includes(query) ||
        team.groupName?.toLowerCase().includes(query)
      )
    })
  }, [data?.availableTeams, groupFilter, teamSearch, tierFilter])

  function squadForTeam(team: Team) {
    return POSITION_SECTIONS.map((section) => ({
      label: section.label,
      players: team.squad.filter(
        (m) => m.position === section.key && m.squad_role === 'player',
      ),
    })).filter((s) => s.players.length > 0)
  }

  function allTeamsInGroup(team: Team) {
    if (!data || !team.groupName) return [team]
    return data.teams.filter((t) => t.groupName === team.groupName)
  }

  async function confirmPick() {
    if (!pendingPickTeam) return
    const teamId = pendingPickTeam.id
    setPendingPickTeam(null)
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const currentPlayer = data?.currentPlayerId
    ? (playersById.get(data.currentPlayerId) ?? null)
    : null

  return (
    <main className="app-shell">
      <NavBar />

      {error ? <p className="error-text">{error}</p> : null}

      {data && (
        <section className="card on-the-clock">
          {data.isComplete ? (
            <span className="clock-name">🏆 Draft complete! All {data.maxPicks} picks made.</span>
          ) : currentPlayer ? (
            <>
              <span className="muted">Round {data.currentRound}</span>
              {' — '}
              <span className="clock-name" style={{ color: currentPlayer.colour }}>
                {currentPlayer.name}
              </span>
              {' is on the clock — Pick '}
              {data.picks.length + 1}
              {' of '}
              {data.maxPicks}
            </>
          ) : (
            <span className="muted">Loading draft state…</span>
          )}
        </section>
      )}

      {!data?.isComplete && (
        <div className="card draft-available-card">
          <div className="draft-toolbar">
            <input
              className="field draft-filter"
              placeholder="Search team, code, or group"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
            />
            <select
              className="field draft-filter"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="ALL">All groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>Group {g}</option>
              ))}
            </select>
            <select
              className="field draft-filter"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="ALL">All tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => { setTeamSearch(''); setGroupFilter('ALL'); setTierFilter('ALL') }}
            >
              Clear
            </button>
            <button className="ghost-btn" type="button" onClick={loadDraft} disabled={busy}>
              Refresh
            </button>
          </div>
          <p className="muted draft-filter-summary">{filteredAvailableTeams.length} teams available</p>
          <div className="draft-card-body draft-team-list">
            <div className="team-grid">
              {filteredAvailableTeams.length === 0 && (
                <p className="muted">No teams match the current filters.</p>
              )}
              {filteredAvailableTeams.map((team) => (
                <div key={team.id} className="team-card">
                  <span className="team-main">
                    <span className="team-badges">
                      <span className="group-pill">
                        {team.groupName ? `Group ${team.groupName}` : 'Group TBD'}
                      </span>
                      <span className="rank-pill">#{team.ranking ?? '-'}</span>
                    </span>
                    <strong>{team.name}</strong>
                    <span className="team-meta">
                      <span>{team.code ?? 'N/A'}</span>
                      <span>Tier {team.tier}</span>
                    </span>
                  </span>
                  <span className="team-side">
                    <span className="tier">T{team.tier}</span>
                  </span>
                  <div className="team-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        setExpandedSquadId(expandedSquadId === team.id ? null : team.id)
                      }
                    >
                      {expandedSquadId === team.id ? 'Hide Squad' : 'Squad'}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        setExpandedGroupId(expandedGroupId === team.id ? null : team.id)
                      }
                    >
                      {expandedGroupId === team.id ? 'Hide Group' : 'Group'}
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={busy}
                      onClick={() => setPendingPickTeam(team)}
                    >
                      Draft
                    </button>
                  </div>

                  {expandedSquadId === team.id && (
                    <div className="squad-inline">
                      {(() => {
                        const mgr = team.squad.find((m) => m.squad_role === 'manager')
                        return mgr ? <p className="muted">Manager: {mgr.name}</p> : null
                      })()}
                      {squadForTeam(team).map((section) => (
                        <div key={section.label} className="squad-inline-section">
                          <h5>{section.label}</h5>
                          <ul className="squad-inline-list">
                            {section.players.map((p) => (
                              <li key={p.id}>
                                {p.shirt_number ? `${p.shirt_number}. ` : ''}{p.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {squadForTeam(team).length === 0 && (
                        <p className="muted">No squad data yet.</p>
                      )}
                    </div>
                  )}

                  {expandedGroupId === team.id && (
                    <div className="group-inline">
                      <h5>Group {team.groupName ?? 'TBD'}</h5>
                      <ul className="group-inline-list">
                        {allTeamsInGroup(team).map((t) => (
                          <li
                            key={t.id}
                            className={`group-inline-item${t.id === team.id ? ' is-self' : ''}`}
                          >
                            <span>
                              {t.name}{' '}
                              <span className="muted">#{t.ranking ?? '-'}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="card">
        <h2 className="subhead">Player Rosters</h2>
        <div className="roster-list">
          {rosters.map((player) => {
            const isOnClock = data?.currentPlayerId === player.id && !data?.isComplete
            return (
              <div key={player.id} className="roster-block">
                <h3
                  className={isOnClock ? 'clock-name' : undefined}
                  style={{ color: player.colour }}
                >
                  {isOnClock ? '● ' : ''}{player.name}
                </h3>
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
            )
          })}
        </div>
      </section>

      {pendingPickTeam && (
        <div
          className="drawer-backdrop"
          style={{ alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPendingPickTeam(null)}
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="muted" style={{ marginBottom: 4 }}>Confirm pick</p>
              <p className="confirm-team-name">{pendingPickTeam.name}</p>
              <p className="muted" style={{ marginTop: 4 }}>
                Group {pendingPickTeam.groupName ?? 'TBD'} · #{pendingPickTeam.ranking ?? '-'} · Tier {pendingPickTeam.tier}
              </p>
            </div>
            <div className="row">
              <button
                type="button"
                className="ghost-btn"
                style={{ flex: 1 }}
                onClick={() => setPendingPickTeam(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={confirmPick}
              >
                Confirm Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
