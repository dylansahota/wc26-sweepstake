import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSession } from '@/lib/api-auth'
import { recalculateTeamProgressFromMatches } from '@/lib/progress'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeTeamName } from '@/lib/team-names'

interface MatchUpdateBody {
  matchId?: string
  homeScore?: number | null
  awayScore?: number | null
  status?: 'scheduled' | 'finished'
  winnerTeamId?: string | null
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [{ data: matches, error: matchesError }, { data: teams, error: teamsError }] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select(
        'id, stage, group_name, kickoff_utc, home_team_id, away_team_id, home_placeholder, away_placeholder, home_score, away_score, winner_team_id, status'
      )
      .order('kickoff_utc', { ascending: true }),
    supabaseAdmin.from('teams').select('id, name, code').order('name'),
  ])

  if (matchesError || teamsError) {
    return NextResponse.json({ error: matchesError?.message ?? teamsError?.message ?? 'Unknown error' }, { status: 500 })
  }

  const teamsById = new Map((teams ?? []).map((team) => [team.id, team]))

  const rows = (matches ?? []).map((match) => ({
    ...match,
    home_placeholder: normalizeTeamName(match.home_placeholder) ?? match.home_placeholder,
    away_placeholder: normalizeTeamName(match.away_placeholder) ?? match.away_placeholder,
    homeTeam: match.home_team_id ? teamsById.get(match.home_team_id) ?? null : null,
    awayTeam: match.away_team_id ? teamsById.get(match.away_team_id) ?? null : null,
    winnerTeam: match.winner_team_id ? teamsById.get(match.winner_team_id) ?? null : null,
  }))

  return NextResponse.json({ matches: rows })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as MatchUpdateBody
  if (!body.matchId) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('id', body.matchId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message ?? 'Match not found' }, { status: 404 })
  }

  let inferredWinner: string | null = body.winnerTeamId ?? null
  const status = body.status ?? 'finished'

  if (status === 'finished' && body.homeScore != null && body.awayScore != null && !inferredWinner) {
    if (body.homeScore > body.awayScore) {
      inferredWinner = existing.home_team_id
    } else if (body.awayScore > body.homeScore) {
      inferredWinner = existing.away_team_id
    }
  }

  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      home_score: body.homeScore ?? null,
      away_score: body.awayScore ?? null,
      status,
      winner_team_id: inferredWinner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.matchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recalculateTeamProgressFromMatches()
  return NextResponse.json({ ok: true })
}
