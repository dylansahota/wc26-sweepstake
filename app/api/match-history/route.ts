import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { buildScoringHistory, HistoryMatchRow, HistoryPickRow, HistoryPlayerRow } from '@/lib/history'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [{ data: players, error: playersError }, { data: picks, error: picksError }, { data: matches, error: matchesError }, { data: teams, error: teamsError }] =
    await Promise.all([
      supabaseAdmin.from('players').select('id, name, colour').order('name'),
      supabaseAdmin.from('draft_picks').select('player_id, team_id, teams(name, tier)'),
      supabaseAdmin
        .from('matches')
        .select('id, kickoff_utc, stage, group_name, status, home_team_id, away_team_id, home_score, away_score, winner_team_id')
        .eq('status', 'finished')
        .order('kickoff_utc', { ascending: true }),
      supabaseAdmin.from('teams').select('id, name'),
    ])

  if (playersError || picksError || matchesError || teamsError) {
    return NextResponse.json(
      { error: playersError?.message ?? picksError?.message ?? matchesError?.message ?? teamsError?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }

  const normalizedPicks = ((picks ?? []) as Array<{
    player_id: string
    team_id: string
    teams: { name: string; tier: 1 | 2 | 3 } | Array<{ name: string; tier: 1 | 2 | 3 }> | null
  }>).map((pick) => ({
    player_id: pick.player_id,
    team_id: pick.team_id,
    teams: Array.isArray(pick.teams) ? (pick.teams[0] ?? null) : pick.teams,
  }))

  const teamNamesById = new Map((teams ?? []).map((team) => [team.id as string, team.name as string]))
  const history = buildScoringHistory(
    (players ?? []) as HistoryPlayerRow[],
    normalizedPicks as HistoryPickRow[],
    (matches ?? []) as HistoryMatchRow[],
    teamNamesById
  )

  return NextResponse.json({ matches: history.matches })
}
