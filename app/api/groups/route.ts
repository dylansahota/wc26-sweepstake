import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getWorldRanking } from '@/lib/team-metadata'
import { normalizeTeamName } from '@/lib/team-names'

export interface GroupTeamRow {
  position: number
  teamId: string
  teamName: string
  code: string | null
  ranking: number | null
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

export interface GroupFixture {
  id: string
  kickoffUtc: string
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
}

export interface GroupStanding {
  name: string
  teams: GroupTeamRow[]
  fixtures: GroupFixture[]
}

export interface ThirdPlacePlayoff {
  id: string
  kickoffUtc: string
  status: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  winnerTeamName: string | null
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const [
    { data: teams, error: teamsError },
    { data: matches, error: matchesError },
    { data: picks, error: picksError },
    { data: players, error: playersError },
    { data: thirdPlaceMatches, error: thirdPlaceError },
  ] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name, code, tier'),
    supabaseAdmin
      .from('matches')
      .select('id, kickoff_utc, group_name, home_team_id, away_team_id, home_placeholder, away_placeholder, home_score, away_score, status')
      .eq('stage', 'GROUP')
      .not('group_name', 'is', null)
      .order('group_name')
      .order('kickoff_utc', { ascending: true }),
    supabaseAdmin.from('draft_picks').select('player_id, team_id, teams(tier)'),
    supabaseAdmin.from('players').select('id, name, colour'),
    supabaseAdmin
      .from('matches')
      .select('id, kickoff_utc, status, home_team_id, away_team_id, home_placeholder, away_placeholder, home_score, away_score, winner_team_id')
      .eq('stage', 'THIRD_PLACE')
      .order('kickoff_utc', { ascending: true })
      .limit(1),
  ])

  if (teamsError || matchesError || picksError || playersError || thirdPlaceError) {
    return NextResponse.json(
      {
        error:
          teamsError?.message ??
          matchesError?.message ??
          picksError?.message ??
          playersError?.message ??
          thirdPlaceError?.message ??
          'Unknown error',
      },
      { status: 500 }
    )
  }

  const teamById = new Map((teams ?? []).map((t) => [t.id as string, t]))
  const teamIdByName = new Map((teams ?? []).map((t) => [t.name as string, t.id as string]))
  const playerById = new Map((players ?? []).map((p) => [p.id as string, p]))
  const ownerByTeamId = new Map(
    ((picks ?? []) as Array<{ player_id: string; team_id: string }>).map((pick) => [pick.team_id, pick.player_id])
  )

  // Derive groups from which teams appear in group matches
  const groupTeamSet = new Map<string, Set<string>>()
  const groupFixtures = new Map<string, GroupFixture[]>()
  for (const match of matches ?? []) {
    const g = match.group_name as string

    const resolvedHomeId =
      (match.home_team_id as string | null) ??
      (() => {
        const normalized = normalizeTeamName((match.home_placeholder as string | null) ?? null)
        return normalized ? teamIdByName.get(normalized) ?? null : null
      })()

    const resolvedAwayId =
      (match.away_team_id as string | null) ??
      (() => {
        const normalized = normalizeTeamName((match.away_placeholder as string | null) ?? null)
        return normalized ? teamIdByName.get(normalized) ?? null : null
      })()

    if (!groupTeamSet.has(g)) groupTeamSet.set(g, new Set())
    if (resolvedHomeId) groupTeamSet.get(g)!.add(resolvedHomeId)
    if (resolvedAwayId) groupTeamSet.get(g)!.add(resolvedAwayId)

    const fixtures = groupFixtures.get(g) ?? []
    fixtures.push({
      id: match.id as string,
      kickoffUtc: match.kickoff_utc as string,
      status: match.status as string,
      homeTeamId: resolvedHomeId,
      awayTeamId: resolvedAwayId,
      homeTeamName: resolvedHomeId
        ? ((teamById.get(resolvedHomeId)?.name as string | undefined) ?? 'TBD')
        : normalizeTeamName((match.home_placeholder as string | null) ?? null) ?? 'TBD',
      awayTeamName: resolvedAwayId
        ? ((teamById.get(resolvedAwayId)?.name as string | undefined) ?? 'TBD')
        : normalizeTeamName((match.away_placeholder as string | null) ?? null) ?? 'TBD',
      homeScore: (match.home_score as number | null) ?? null,
      awayScore: (match.away_score as number | null) ?? null,
    })
    groupFixtures.set(g, fixtures)
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
        position: 0,
        teamId,
        teamName: team.name as string,
        code: (team.code as string | null) ?? null,
        ranking: getWorldRanking(team.name as string),
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
    const homeId =
      (match.home_team_id as string | null) ??
      (() => {
        const normalized = normalizeTeamName((match.home_placeholder as string | null) ?? null)
        return normalized ? teamIdByName.get(normalized) ?? null : null
      })()
    const awayId =
      (match.away_team_id as string | null) ??
      (() => {
        const normalized = normalizeTeamName((match.away_placeholder as string | null) ?? null)
        return normalized ? teamIdByName.get(normalized) ?? null : null
      })()
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
    .map(([name, unsortedTeams]) => {
      const teams = unsortedTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        return a.teamName.localeCompare(b.teamName)
      })

      return {
        name,
        teams: teams.map((team, index) => ({ ...team, position: index + 1 })),
        fixtures: groupFixtures.get(name) ?? [],
      }
    })

  const thirdPlaceMatch = (thirdPlaceMatches ?? [])[0]
  const thirdPlacePlayoff: ThirdPlacePlayoff | null = thirdPlaceMatch
    ? {
        id: thirdPlaceMatch.id as string,
        kickoffUtc: thirdPlaceMatch.kickoff_utc as string,
        status: thirdPlaceMatch.status as string,
        homeTeamName: thirdPlaceMatch.home_team_id
          ? ((teamById.get(thirdPlaceMatch.home_team_id as string)?.name as string | undefined) ?? 'TBD')
          : normalizeTeamName((thirdPlaceMatch.home_placeholder as string | null) ?? null) ?? 'TBD',
        awayTeamName: thirdPlaceMatch.away_team_id
          ? ((teamById.get(thirdPlaceMatch.away_team_id as string)?.name as string | undefined) ?? 'TBD')
          : normalizeTeamName((thirdPlaceMatch.away_placeholder as string | null) ?? null) ?? 'TBD',
        homeScore: (thirdPlaceMatch.home_score as number | null) ?? null,
        awayScore: (thirdPlaceMatch.away_score as number | null) ?? null,
        winnerTeamName: thirdPlaceMatch.winner_team_id
          ? ((teamById.get(thirdPlaceMatch.winner_team_id as string)?.name as string | undefined) ?? null)
          : null,
      }
    : null

  return NextResponse.json({ groups, thirdPlacePlayoff })
}
