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
  playerId: string
  name: string
  colour: string
  totals: number[]
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<PlayerScore[]>([])
  const [history, setHistory] = useState<{ dates: string[]; series: ScoreHistorySeries[] }>({ dates: [], series: [] })
  const [error, setError] = useState('')

  async function load() {
    const [leaderboardRes, historyRes] = await Promise.all([
      fetch('/api/leaderboard', { cache: 'no-store' }),
      fetch('/api/score-history', { cache: 'no-store' }),
    ])

    const leaderboardPayload = (await leaderboardRes.json()) as { leaderboard?: PlayerScore[]; error?: string }
    const historyPayload = (await historyRes.json()) as {
      dates?: string[]
      series?: ScoreHistorySeries[]
      error?: string
    }

    if (!leaderboardRes.ok || !leaderboardPayload.leaderboard) {
      setError(leaderboardPayload.error ?? 'Failed to load leaderboard')
      return
    }

    if (!historyRes.ok || !historyPayload.dates || !historyPayload.series) {
      setError(historyPayload.error ?? 'Failed to load score history')
      return
    }

    setRows(leaderboardPayload.leaderboard)
    setHistory({ dates: historyPayload.dates, series: historyPayload.series })
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

  const chartData = useMemo(() => {
    return {
      labels: history.dates,
      datasets: history.series.map((series, index) => ({
        label: series.name,
        data: series.totals,
        borderColor: series.colour,
        backgroundColor: `${series.colour}22`,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 2,
        borderDash: index % 2 === 0 ? [] : [6, 4],
      })),
    }
  }, [history.dates, history.series])

  return (
    <main className="app-shell">
      <NavBar />

      <section className="card">
        <h1 className="title">Live Leaderboard</h1>
        <p className="muted">Points = base score x tier multiplier</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="card">
        <h2 className="subhead">Score Progression</h2>
        {history.dates.length === 0 ? (
          <p className="muted">No finished matches yet.</p>
        ) : (
          <div style={{ height: 280 }}>
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
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
