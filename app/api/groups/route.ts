import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'

export interface GroupTeamRow {
  teamId: string
  teamName: string
  code: string | null
  // draft info
  ownerId: string | null
  ownerName: string | null
  ownerColour: string | null
  tier: 1 | 2 | 3 | null
  // standings
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface GroupStanding {
  name: string
  teams: GroupTeamRow[]
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [
    { data: teams, error: teamsError },
    { data: matches, error: matchesError },
    { data: picks, error: picksError },
    { data: players, error: playersError },
  ] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name, code, tier'),
    supabaseAdmin
      .from('matches')
      .select('group_name, home_team_id, away_team_id, home_score, away_score, status')
      .eq('stage', 'GROUP')
      .not('group_name', 'is', null)
      .order('group_name'),
    supabaseAdmin.from('draft_picks').select('player_id, team_id, teams(tier)'),
    supabaseAdmin.from('players').select('id, name, colour'),
  ])

  if (teamsError || matchesError || picksError || playersError) {
    return NextResponse.json(
      { error: teamsError?.message ?? matchesError?.message ?? picksError?.message ?? playersError?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }

  const teamById = new Map((teams ?? []).map((t) => [t.id as string, t]))
  const playerById = new Map((players ?? []).map((p) => [p.id as string, p]))
  const ownerByTeamId = new Map(
    ((picks ?? []) as Array<{ player_id: string; team_id: string }>).map((pick) => [pick.team_id, pick.player_id])
  )

  // Derive groups from which teams appear in group matches
  const groupTeamSet = new Map<string, Set<string>>()
  for (const match of matches ?? []) {
    const g = match.group_name as string
    if (!groupTeamSet.has(g)) groupTeamSet.set(g, new Set())
    if (match.home_team_id) groupTeamSet.get(g)!.add(match.home_team_id as string)
    if (match.away_team_id) groupTeamSet.get(g)!.add(match.away_team_id as string)
  }

  // Initialise standings rows
  const standingsMap = new Map<string, GroupTeamRow>()
  for (const [groupName, teamIds] of groupTeamSet) {
    for (const teamId of teamIds) {
      const team = teamById.get(teamId)
      if (!team) continue
      const ownerId = ownerByTeamId.get(teamId) ?? null
      const owner = ownerId ? playerById.get(ownerId) ?? null : null

      standingsMap.set(`${groupName}:${teamId}`, {
        teamId,
        teamName: team.name as string,
        code: (team.code as string | null) ?? null,
        ownerId,
        ownerName: owner ? (owner.name as string) : null,
        ownerColour: owner ? (owner.colour as string) : null,
        tier: (team.tier as 1 | 2 | 3) ?? null,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      })
    }
  }

  // Tally finished matches
  for (const match of matches ?? []) {
    if (match.status !== 'finished') continue
    if (match.home_score == null || match.away_score == null) continue

    const g = match.group_name as string
    const homeId = match.home_team_id as string | null
    const awayId = match.away_team_id as string | null
    const homeScore = match.home_score as number
    const awayScore = match.away_score as number

    const homeRow = homeId ? standingsMap.get(`${g}:${homeId}`) : null
    const awayRow = awayId ? standingsMap.get(`${g}:${awayId}`) : null

    if (homeRow) {
      homeRow.played += 1
      homeRow.goalsFor += homeScore
      homeRow.goalsAgainst += awayScore
      if (homeScore > awayScore) homeRow.won += 1
      else if (homeScore === awayScore) homeRow.drawn += 1
      else homeRow.lost += 1
    }
    if (awayRow) {
      awayRow.played += 1
      awayRow.goalsFor += awayScore
      awayRow.goalsAgainst += homeScore
      if (awayScore > homeScore) awayRow.won += 1
      else if (homeScore === awayScore) awayRow.drawn += 1
      else awayRow.lost += 1
    }
  }

  // Compute derived stats and sort within each group
  const groupsMap = new Map<string, GroupTeamRow[]>()
  for (const [key, row] of standingsMap) {
    const groupName = key.split(':')[0]
    row.goalDifference = row.goalsFor - row.goalsAgainst
    row.points = row.won * 3 + row.drawn
    const existing = groupsMap.get(groupName) ?? []
    existing.push(row)
    groupsMap.set(groupName, existing)
  }

  const groups: GroupStanding[] = Array.from(groupsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, unsortedTeams]) => ({
      name,
      teams: unsortedTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        return a.teamName.localeCompare(b.teamName)
      }),
    }))

  return NextResponse.json({ groups })
}
