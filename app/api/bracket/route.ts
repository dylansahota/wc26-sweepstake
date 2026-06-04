import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeTeamName } from '@/lib/team-names'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [{ data: matches, error: matchesError }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select(
        'id, stage, kickoff_utc, home_team_id, away_team_id, home_placeholder, away_placeholder, home_score, away_score, status'
      )
      .neq('stage', 'GROUP')
      .order('kickoff_utc', { ascending: true }),
    supabaseAdmin.from('teams').select('id, name').order('name'),
  ])

  if (matchesError || teamsError) {
    return NextResponse.json({ error: matchesError?.message ?? teamsError?.message ?? 'Unknown error' }, { status: 500 })
  }

  const teamsById = new Map((teams ?? []).map((team) => [team.id, team.name]))

  const bracket = (matches ?? []).map((match) => ({
    ...match,
    homeName: match.home_team_id
      ? teamsById.get(match.home_team_id) ?? normalizeTeamName(match.home_placeholder) ?? 'TBD'
      : normalizeTeamName(match.home_placeholder) ?? 'TBD',
    awayName: match.away_team_id
      ? teamsById.get(match.away_team_id) ?? normalizeTeamName(match.away_placeholder) ?? 'TBD'
      : normalizeTeamName(match.away_placeholder) ?? 'TBD',
  }))

  return NextResponse.json({ bracket })
}
