'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import NavBar from '@/app/components/NavBar'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface TeamScore {
  teamId: string
  teamName: string
  tier: 1 | 2 | 3
  basePoints: number
  multiplier: number
  totalPoints: number
}

interface PlayerScore {
  id: string
  name: string
  colour: string
  totalPoints: number
  teams: TeamScore[]
}

interface ScoreHistorySeries {
  entityId: string
  label: string
  colour: string
  totals: number[]
  ownerId?: string
  ownerName?: string
}

interface TeamRow {
  teamId: string
  teamName: string
  ownerId: string
  ownerName: string
  ownerColour: string
  tier: 1 | 2 | 3
  currentPoints: number
}

function formatWeekdayLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<PlayerScore[]>([])
  const [history, setHistory] = useState<{ dates: string[]; playerSeries: ScoreHistorySeries[]; teamSeries: ScoreHistorySeries[] }>({
    dates: [],
    playerSeries: [],
    teamSeries: [],
  })
  const [error, setError] = useState('')
  const [chartView, setChartView] = useState<'players' | 'teams'>('players')
  const [teamOwnerFilter, setTeamOwnerFilter] = useState<string>('all')

  async function load() {
    const [leaderboardRes, historyRes] = await Promise.all([
      fetch('/api/leaderboard', { cache: 'no-store' }),
      fetch('/api/score-history', { cache: 'no-store' }),
    ])

    const leaderboardPayload = (await leaderboardRes.json()) as { leaderboard?: PlayerScore[]; error?: string }
    const historyPayload = (await historyRes.json()) as {
      dates?: string[]
      playerSeries?: ScoreHistorySeries[]
      teamSeries?: ScoreHistorySeries[]
      error?: string
    }

    if (!leaderboardRes.ok || !leaderboardPayload.leaderboard) {
      setError(leaderboardPayload.error ?? 'Failed to load leaderboard')
      return
    }

    if (!historyRes.ok || !historyPayload.dates || !historyPayload.playerSeries || !historyPayload.teamSeries) {
      setError(historyPayload.error ?? 'Failed to load score history')
      return
    }

    setRows(leaderboardPayload.leaderboard)
    setHistory({
      dates: historyPayload.dates,
      playerSeries: historyPayload.playerSeries,
      teamSeries: historyPayload.teamSeries,
    })
    setError('')
  }

  useEffect(() => {
    const initial = setTimeout(() => {
      void load()
    }, 0)
    const interval = setInterval(load, 10000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  const maxScore = useMemo(() => {
    if (rows.length === 0) return 1
    return Math.max(...rows.map((r) => r.totalPoints), 1)
  }, [rows])

  const teamOwnerOptions = useMemo(() => {
    const owners = new Map<string, string>()
    for (const series of history.teamSeries) {
      if (!series.ownerId || !series.ownerName) continue
      owners.set(series.ownerId, series.ownerName)
    }
    return Array.from(owners.entries()).sort((left, right) => left[1].localeCompare(right[1]))
  }, [history.teamSeries])

  const teamRows = useMemo(() => {
    const rowsList: TeamRow[] = []

    for (const player of rows) {
      for (const team of player.teams) {
        rowsList.push({
          teamId: team.teamId,
          teamName: team.teamName,
          ownerId: player.id,
          ownerName: player.name,
          ownerColour: player.colour,
          tier: team.tier,
          currentPoints: team.totalPoints,
        })
      }
    }

    return rowsList.sort((left, right) => {
      if (right.currentPoints !== left.currentPoints) return right.currentPoints - left.currentPoints
      return left.teamName.localeCompare(right.teamName)
    })
  }, [rows])

  const visibleSeries = useMemo(() => {
    if (chartView === 'players') {
      return history.playerSeries
    }

    if (teamOwnerFilter === 'all') {
      return history.teamSeries
    }

    return history.teamSeries.filter((series) => series.ownerId === teamOwnerFilter)
  }, [chartView, history.playerSeries, history.teamSeries, teamOwnerFilter])

  const chartData = useMemo(() => {
    return {
      labels: history.dates.map((value) => formatWeekdayLabel(value)),
      datasets: visibleSeries.map((series, index) => ({
        label: series.ownerName && chartView === 'teams' ? `${series.label} · ${series.ownerName}` : series.label,
        data: series.totals,
        borderColor: series.colour,
        backgroundColor: `${series.colour}22`,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 2,
        borderDash: index % 2 === 0 ? [] : [6, 4],
      })),
    }
  }, [chartView, history.dates, visibleSeries])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Live Leaderboard</h1>
        <p className="muted">Points = base score x tier multiplier</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="card">
        <div className="row split section-toolbar">
          <div>
            <h2 className="subhead">Score Progression</h2>
            <p className="muted">Player lines show progression by tournament weekday.</p>
          </div>
          <div className="row">
            <button
              type="button"
              className={chartView === 'players' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setChartView('players')}
            >
              Players
            </button>
            <button
              type="button"
              className={chartView === 'teams' ? 'primary-btn' : 'ghost-btn'}
              onClick={() => setChartView('teams')}
            >
              Teams
            </button>
            {chartView === 'teams' ? (
              <select className="field chart-filter" value={teamOwnerFilter} onChange={(event) => setTeamOwnerFilter(event.target.value)}>
                <option value="all">All players</option>
                {teamOwnerOptions.map(([ownerId, ownerName]) => (
                  <option key={ownerId} value={ownerId}>
                    {ownerName}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        {history.dates.length === 0 ? (
          <p className="muted">No finished matches yet.</p>
        ) : visibleSeries.length === 0 ? (
          <p className="muted">No drafted teams for the selected player yet.</p>
        ) : (
          <div style={{ height: 280 }}>
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: chartView === 'players' || visibleSeries.length <= 12,
                    labels: { color: '#9eb3c6' },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: '#9eb3c6' },
                    grid: { color: '#27445c66' },
                  },
                  y: {
                    ticks: { color: '#9eb3c6' },
                    grid: { color: '#27445c66' },
                  },
                },
              }}
            />
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="subhead">Team Points Table</h2>
        <p className="muted">Current points by team, including owner and tier multiplier context.</p>
        <div className="team-points-table">
          <div className="team-points-row team-points-head">
            <span>Team</span>
            <span>Owner</span>
            <span>Tier</span>
            <span>Points</span>
          </div>
          {teamRows.map((team) => (
            <div key={team.teamId} className="team-points-row">
              <span>{team.teamName}</span>
              <span style={{ color: team.ownerColour }}>{team.ownerName}</span>
              <span>T{team.tier}</span>
              <strong>{team.currentPoints}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card leaderboard-list">
        {rows.map((player, index) => (
          <article key={player.id} className="leaderboard-row">
            <div className="row split">
              <div className="row" style={{ gap: 10 }}>
                <span className="rank">#{index + 1}</span>
                <span className="avatar" style={{ background: player.colour }} />
                <strong>{player.name}</strong>
              </div>
              <strong>{player.totalPoints.toFixed(1)} pts</strong>
            </div>
            <div className="bar-wrap">
              <div className="bar-fill" style={{ width: `${(player.totalPoints / maxScore) * 100}%`, background: player.colour }} />
            </div>
            <div className="mini-table">
              {player.teams.map((team) => (
                <p key={team.teamId}>
                  {team.teamName}: {team.basePoints} x {team.multiplier} = {team.totalPoints}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
