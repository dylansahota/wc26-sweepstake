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

function rankBadgeClass(index: number): string {
  if (index === 0) return 'rank-badge-1'
  if (index === 1) return 'rank-badge-2'
  if (index === 2) return 'rank-badge-3'
  return 'rank-badge-other'
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<PlayerScore[]>([])
  const [history, setHistory] = useState<{ dates: string[]; playerSeries: ScoreHistorySeries[] }>({
    dates: [],
    playerSeries: [],
  })
  const [error, setError] = useState('')

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

    if (!historyRes.ok || !historyPayload.dates || !historyPayload.playerSeries) {
      setError(historyPayload.error ?? 'Failed to load score history')
      return
    }

    setRows(leaderboardPayload.leaderboard)
    setHistory({
      dates: historyPayload.dates,
      playerSeries: historyPayload.playerSeries,
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

  const chartData = useMemo(() => {
    const CHART_START = '2026-06-10'
    const needsStart = history.dates.length === 0 || history.dates[0] > CHART_START
    const dates = needsStart ? [CHART_START, ...history.dates] : history.dates

    return {
      labels: dates.map((value) => formatWeekdayLabel(value)),
      datasets: history.playerSeries.map((series) => ({
        label: series.label,
        data: needsStart ? [0, ...series.totals] : series.totals,
        borderColor: series.colour,
        backgroundColor: `${series.colour}22`,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 2,
      })),
    }
  }, [history.dates, history.playerSeries])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Live Leaderboard</h1>
        <p className="muted">Points = base score x tier multiplier</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {/* 1. Player leaderboard cards */}
      <section className="card leaderboard-list">
        {rows.map((player, index) => (
          <article key={player.id} className={`leaderboard-row rank-${index < 3 ? index + 1 : 'other'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`leaderboard-rank-badge ${rankBadgeClass(index)}`}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                <span className="avatar" style={{ background: player.colour, width: 14, height: 14 }} />
                <strong style={{ fontSize: '1.05rem' }}>{player.name}</strong>
              </div>
              <strong style={{ color: '#ffd87a', fontSize: '1.15rem' }}>{player.totalPoints.toFixed(1)} pts</strong>
            </div>
            <div className="bar-wrap">
              <div className="bar-fill" style={{ width: `${(player.totalPoints / maxScore) * 100}%`, background: player.colour }} />
            </div>
            <div className="player-teams-wrap">
              {player.teams.map((team) => (
                <span key={team.teamId} className="player-team-chip">
                  <span>{team.teamName}</span>
                  <span className="muted">+{team.totalPoints}</span>
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* 2. Score Progression chart */}
      <section className="card">
        <div className="row split section-toolbar">
          <div>
            <h2 className="subhead">Score Progression</h2>
          </div>
        </div>
        {history.dates.length === 0 ? (
          <p className="muted">Chart will update after the first match day</p>
        ) : (
          <div style={{ height: 280 }}>
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
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

      {/* 3. Team Points Table */}
      <section className="card">
        <h2 className="subhead">Team Points Table</h2>
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
    </main>
  )
}
