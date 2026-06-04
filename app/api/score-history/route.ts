import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getTierMultiplier } from '@/lib/domain'
import { applyMatchToProgress, emptyProgress, MatchProgressRow, TeamProgressState } from '@/lib/progress'
import { calculateBasePoints } from '@/lib/scoring'
import { supabaseAdmin } from '@/lib/supabase'

interface PickRow {
  player_id: string
  team_id: string
  teams: { tier: 1 | 2 | 3 } | Array<{ tier: 1 | 2 | 3 }> | null
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [{ data: players, error: playersError }, { data: picks, error: picksError }, { data: matches, error: matchesError }] =
    await Promise.all([
      supabaseAdmin.from('players').select('id, name, colour').order('name'),
      supabaseAdmin.from('draft_picks').select('player_id, team_id, teams(tier)'),
      supabaseAdmin
        .from('matches')
        .select('kickoff_utc, stage, status, home_team_id, away_team_id, home_score, away_score, winner_team_id')
        .eq('status', 'finished')
        .order('kickoff_utc', { ascending: true }),
    ])

  if (playersError || picksError || matchesError) {
    return NextResponse.json(
      { error: playersError?.message ?? picksError?.message ?? matchesError?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }

  const normalizedPicks = ((picks ?? []) as PickRow[]).map((pick) => ({
    player_id: pick.player_id,
    team_id: pick.team_id,
    tier: Array.isArray(pick.teams) ? (pick.teams[0]?.tier ?? 3) : (pick.teams?.tier ?? 3),
  }))

  const allTeamIds = new Set(normalizedPicks.map((pick) => pick.team_id))
  const progressByTeam = new Map<string, TeamProgressState>()
  for (const teamId of allTeamIds) {
    progressByTeam.set(teamId, emptyProgress())
  }

  const dates: string[] = []
  const totalsByPlayer = new Map<string, number[]>()

  function snapshot(dateKey: string) {
    dates.push(dateKey)
    for (const player of players ?? []) {
      const playerPicks = normalizedPicks.filter((pick) => pick.player_id === player.id)
      let total = 0
      for (const pick of playerPicks) {
        const progress = progressByTeam.get(pick.team_id) ?? emptyProgress()
        const base = calculateBasePoints(progress)
        total += base * getTierMultiplier(pick.tier)
      }

      const existing = totalsByPlayer.get(player.id) ?? []
      existing.push(total)
      totalsByPlayer.set(player.id, existing)
    }
  }

  let currentDateKey = ''
  for (const match of (matches ?? []) as Array<MatchProgressRow & { kickoff_utc: string }>) {
    const dateKey = match.kickoff_utc.slice(0, 10)
    if (currentDateKey && dateKey !== currentDateKey) {
      snapshot(currentDateKey)
    }
    currentDateKey = dateKey
    applyMatchToProgress(progressByTeam, match)
  }

  if (currentDateKey) {
    snapshot(currentDateKey)
  }

  const series = (players ?? []).map((player) => ({
    playerId: player.id,
    name: player.name,
    colour: player.colour,
    totals: totalsByPlayer.get(player.id) ?? new Array(dates.length).fill(0),
  }))

  return NextResponse.json({ dates, series })
}
