import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { buildLeaderboard, PickRow, PlayerRow, ProgressRow } from '@/lib/leaderboard'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [{ data: playersData, error: playersError }, { data: picksData, error: picksError }, { data: progressData, error: progressError }] =
    await Promise.all([
      supabaseAdmin.from('players').select('id, name, colour'),
      supabaseAdmin.from('draft_picks').select('player_id, team_id, teams(name, tier)'),
      supabaseAdmin
        .from('team_progress')
        .select(
          'team_id, group_wins, group_draws, qualified_r32, qualified_r16, reached_qf, reached_sf, reached_final, won_tournament'
        ),
    ])

  if (playersError || picksError || progressError) {
    return NextResponse.json(
      { error: playersError?.message ?? picksError?.message ?? progressError?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }

  const normalizedPicks = ((picksData ?? []) as Array<{
    player_id: string
    team_id: string
    teams: { name: string; tier: 1 | 2 | 3 } | Array<{ name: string; tier: 1 | 2 | 3 }> | null
  }>).map((pick) => ({
    player_id: pick.player_id,
    team_id: pick.team_id,
    teams: Array.isArray(pick.teams) ? (pick.teams[0] ?? null) : pick.teams,
  }))

  const leaderboard = buildLeaderboard(
    (playersData ?? []) as PlayerRow[],
    normalizedPicks as PickRow[],
    (progressData ?? []) as ProgressRow[]
  )

  return NextResponse.json({ leaderboard })
}
