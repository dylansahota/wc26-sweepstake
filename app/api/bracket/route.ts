import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { BRACKET_ROUTES } from '@/lib/bracket-routes'
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
  const matchesByStage = new Map<string, typeof matches>()

  for (const match of matches ?? []) {
    const existing = matchesByStage.get(match.stage) ?? []
    existing.push(match)
    matchesByStage.set(match.stage, existing)
  }

  const routeByMatchId = new Map<string, { matchLabel: string; homeRoute: string; awayRoute: string }>()

  for (const [stage, stageMatches] of matchesByStage.entries()) {
    const routes = BRACKET_ROUTES[stage] ?? []
    for (let index = 0; index < stageMatches.length; index += 1) {
      const route = routes[index]
      if (!route) continue
      routeByMatchId.set(stageMatches[index].id as string, route)
    }
  }

  const bracket = (matches ?? []).map((match) => ({
    ...routeByMatchId.get(match.id),
    ...match,
    homeName: match.home_team_id
      ? teamsById.get(match.home_team_id) ?? normalizeTeamName(match.home_placeholder) ?? 'TBD'
      : routeByMatchId.get(match.id)?.homeRoute ?? normalizeTeamName(match.home_placeholder) ?? 'TBD',
    awayName: match.away_team_id
      ? teamsById.get(match.away_team_id) ?? normalizeTeamName(match.away_placeholder) ?? 'TBD'
      : routeByMatchId.get(match.id)?.awayRoute ?? normalizeTeamName(match.away_placeholder) ?? 'TBD',
  }))

  return NextResponse.json({ bracket })
}
