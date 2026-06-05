'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/app/components/NavBar'

interface GroupTeamRow {
  teamId: string
  teamName: string
  code: string | null
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

interface GroupStanding {
  name: string
  teams: GroupTeamRow[]
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupStanding[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

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

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return groups
    return groups
      .map((group) => ({
        ...group,
        teams: group.teams.filter(
          (team) =>
            team.teamName.toLowerCase().includes(q) ||
            team.ownerName?.toLowerCase().includes(q) ||
            group.name.toLowerCase() === q
        ),
      }))
      .filter((group) => group.teams.length > 0)
  }, [groups, search])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card split">
        <div>
          <h1 className="title">Group Standings</h1>
          <p className="muted">12 groups · 48 teams · 72 group matches</p>
        </div>
        <input
          className="field"
          style={{ maxWidth: 220 }}
          placeholder="Filter team or player…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {groups.length === 0 && !error ? (
        <section className="card">
          <p className="muted">Loading standings…</p>
        </section>
      ) : filteredGroups.length === 0 ? (
        <section className="card">
          <p className="muted">No groups match your search.</p>
        </section>
      ) : (
        <div className="groups-grid">
          {filteredGroups.map((group) => (
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
                  <div
                    key={team.teamId}
                    className={`standings-row${index < 2 ? ' qualify-zone' : ''}`}
                  >
                    <span className="standings-team-col">
                      <span
                        className="standings-pos"
                        style={{ color: index < 2 ? '#ffd487' : 'var(--muted)' }}
                      >
                        {index + 1}
                      </span>
                      <span>
                        <span className="standings-name">{team.teamName}</span>
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
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
