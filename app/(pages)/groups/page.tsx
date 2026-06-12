'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface GroupTeamRow {
  position: number
  teamId: string
  teamName: string
  code: string | null
  ranking: number | null
  ownerId: string | null
  ownerName: string | null
  ownerColour: string | null
  tier: 1 | 2 | 3 | null
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

interface GroupFixture {
  id: string
  kickoffUtc: string
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
}

interface GroupStanding {
  name: string
  teams: GroupTeamRow[]
  fixtures: GroupFixture[]
}

const standingsSorter = (left: GroupTeamRow, right: GroupTeamRow) => {
  if (right.points !== left.points) return right.points - left.points
  if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference
  if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor
  return left.teamName.localeCompare(right.teamName)
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function abbreviateTeamName(teamName: string) {
  const compact = teamName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()

  if (!compact) return 'TBD'

  const words = compact.split(/\s+/).filter(Boolean)
  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('')
  }

  const joined = words.join('')
  return joined.slice(0, 3).toUpperCase().padEnd(3, 'X')
}

function teamTableLabel(team: GroupTeamRow) {
  const code = (team.code ?? '').trim().toUpperCase()
  if (/^[A-Z0-9]{3}$/.test(code)) return code
  return abbreviateTeamName(team.teamName)
}

function isMatch(team: GroupTeamRow, group: GroupStanding, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return false
  return (
    team.teamName.toLowerCase().includes(q) ||
    (team.ownerName?.toLowerCase().includes(q) ?? false) ||
    group.name.toLowerCase().includes(q) ||
    (team.code?.toLowerCase().includes(q) ?? false)
  )
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupStanding[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<{ groupName: string; teamId: string } | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const res = await fetch('/api/groups', { cache: 'no-store' })
      const payload = (await res.json()) as { groups?: GroupStanding[]; error?: string }
      if (!active) return
      if (!res.ok || !payload.groups) {
        setError(payload.error ?? 'Failed to load groups')
        return
      }
      setGroups(payload.groups)
      setError('')
    }

    void load()
    const interval = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const bestThirdPlaced = useMemo(() => {
    return groups
      .map((group) => ({ ...group.teams.find((team) => team.position === 3), groupName: group.name }))
      .filter((team): team is GroupTeamRow & { groupName: string } => Boolean(team?.teamId))
      .sort(standingsSorter)
  }, [groups])

  const selectedTeamDetail = useMemo(() => {
    if (!selectedTeam) return null
    const group = groups.find((entry) => entry.name === selectedTeam.groupName)
    if (!group) return null

    const team = group.teams.find((entry) => entry.teamId === selectedTeam.teamId)
    if (!team) return null

    return {
      group,
      team,
      fixtures: group.fixtures.filter(
        (fixture) => fixture.homeTeamId === team.teamId || fixture.awayTeamId === team.teamId
      ),
    }
  }, [groups, selectedTeam])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card split groups-hero">
        <div>
          <h1 className="title">Group Standings</h1>
          <p className="muted">12 groups · 48 teams · 72 group matches</p>
        </div>
        <input
          className="field"
          style={{ maxWidth: 260 }}
          placeholder="Search teams or players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {groups.length === 0 && !error ? (
        <section className="card">
          <p className="muted">Loading standings…</p>
        </section>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <section key={group.name} className="card group-card">
              <h2 className="subhead group-heading">Group {group.name}</h2>
              <div className="standings-table">
                <div className="standings-header">
                  <span className="standings-team-col">Team</span>
                  <span>P</span>
                  <span>W</span>
                  <span>D</span>
                  <span>L</span>
                  <span>GF</span>
                  <span>GA</span>
                  <span>GD</span>
                  <span>Pts</span>
                </div>
                {group.teams.map((team, index) => (
                  <button
                    key={team.teamId}
                    type="button"
                    className={[
                      'standings-row',
                      index < 2 ? 'qualify-zone' : '',
                      search.trim() ? (isMatch(team, group, search) ? 'search-match' : 'search-dim') : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedTeam({ groupName: group.name, teamId: team.teamId })}
                  >
                    <span className="standings-team-col">
                      <span
                        className="standings-pos"
                        style={{ color: index < 2 ? '#ffd487' : 'var(--muted)' }}
                      >
                        {index + 1}
                      </span>
                      <span>
                        <span className="standings-name" title={team.teamName}>{teamTableLabel(team)}</span>
                        {team.ownerName ? (
                          <span
                            className="standings-owner"
                            style={{ color: team.ownerColour ?? 'var(--muted)' }}
                          >
                            {team.ownerName}
                            {team.tier ? ` · T${team.tier}` : ''}
                          </span>
                        ) : (
                          <span className="standings-owner undrafted">Undrafted</span>
                        )}
                      </span>
                    </span>
                    <span>{team.played}</span>
                    <span>{team.won}</span>
                    <span>{team.drawn}</span>
                    <span>{team.lost}</span>
                    <span>{team.goalsFor}</span>
                    <span>{team.goalsAgainst}</span>
                    <span>{team.goalDifference >= 0 ? `+${team.goalDifference}` : team.goalDifference}</span>
                    <span className="standings-pts">{team.points}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {bestThirdPlaced.length > 0 ? (
        <section className="card best-third-card">
          <div className="row split best-third-header">
            <div>
              <h2 className="subhead">Best Third-Placed Table</h2>
              <p className="muted">Top 8 rows are currently in the knockout spots.</p>
            </div>
            <span className="pill">Live Projection</span>
          </div>
          <div className="best-third-table">
            <div className="best-third-row best-third-head">
              <span>Pos</span>
              <span>Team</span>
              <span>Group</span>
              <span>Pts</span>
              <span>GD</span>
              <span>GF</span>
              <span>Owner</span>
            </div>
            {bestThirdPlaced.map((team, index) => (
              <div key={team.teamId} className={`best-third-row${index < 8 ? ' in-cut' : ''}`}>
                <span>{index + 1}</span>
                <span>
                  <strong>{team.teamName}</strong>
                </span>
                <span>{team.groupName}</span>
                <span>{team.points}</span>
                <span>{team.goalDifference >= 0 ? `+${team.goalDifference}` : team.goalDifference}</span>
                <span>{team.goalsFor}</span>
                <span style={{ color: team.ownerColour ?? 'var(--muted)' }}>{team.ownerName ?? 'Undrafted'}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {selectedTeamDetail ? (
        <div className="drawer-backdrop" onClick={() => setSelectedTeam(null)}>
          <aside className="details-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="row split drawer-header">
              <div>
                <span className="pill">Group {selectedTeamDetail.group.name}</span>
                <h2 className="subhead drawer-title">{selectedTeamDetail.team.teamName}</h2>
                <p className="muted">
                  {selectedTeamDetail.team.code ?? 'N/A'} · #{selectedTeamDetail.team.ranking ?? '-'} · Position {selectedTeamDetail.team.position}
                </p>
              </div>
              <button type="button" className="ghost-btn" onClick={() => setSelectedTeam(null)}>
                Close
              </button>
            </div>

            <div className="drawer-stat-grid">
              <div className="drawer-stat">
                <span className="drawer-stat-label">Owner</span>
                <strong style={{ color: selectedTeamDetail.team.ownerColour ?? 'var(--text)' }}>
                  {selectedTeamDetail.team.ownerName ?? 'Undrafted'}
                </strong>
              </div>
              <div className="drawer-stat">
                <span className="drawer-stat-label">Tier</span>
                <strong>T{selectedTeamDetail.team.tier ?? '-'}</strong>
              </div>
              <div className="drawer-stat">
                <span className="drawer-stat-label">Record</span>
                <strong>
                  {selectedTeamDetail.team.won}-{selectedTeamDetail.team.drawn}-{selectedTeamDetail.team.lost}
                </strong>
              </div>
              <div className="drawer-stat">
                <span className="drawer-stat-label">Goal Diff</span>
                <strong>
                  {selectedTeamDetail.team.goalDifference >= 0 ? `+${selectedTeamDetail.team.goalDifference}` : selectedTeamDetail.team.goalDifference}
                </strong>
              </div>
            </div>

            <div className="drawer-section">
              <h3>Group Fixtures</h3>
              <div className="drawer-fixtures">
                {selectedTeamDetail.fixtures.map((fixture) => {
                  const isHome = fixture.homeTeamId === selectedTeamDetail.team.teamId
                  const opponent = isHome ? fixture.awayTeamName : fixture.homeTeamName
                  const teamScore = isHome ? fixture.homeScore : fixture.awayScore
                  const opponentScore = isHome ? fixture.awayScore : fixture.homeScore

                  return (
                    <div key={fixture.id} className="drawer-fixture-card">
                      <div className="row split">
                        <strong>{selectedTeamDetail.team.teamName} vs {opponent}</strong>
                        <span className={`fixture-status ${fixture.status}`}>{fixture.status}</span>
                      </div>
                      <p className="muted">{formatKickoff(fixture.kickoffUtc)}</p>
                      <p className="drawer-fixture-score">
                        {teamScore ?? '-'} - {opponentScore ?? '-'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  )
}
