import { supabaseAdmin } from '@/lib/supabase'
import { normalizeTeamName } from '@/lib/team-names'
import { BRACKET_ROUTES } from '@/lib/bracket-routes'

interface StandingEntry {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

interface GroupResult {
  winner: string | null
  runnerUp: string | null
  thirdPlace: string | null
  thirdPlaceEntry: StandingEntry | null
  complete: boolean
}

const WINNER_RE = /^Winner Group ([A-L])$/
const RUNNER_UP_RE = /^Runner-up Group ([A-L])$/
const BEST_THIRD_RE = /^Best 3rd: ([A-L/]+)$/

function compareStandings(a: StandingEntry, b: StandingEntry): number {
  if (b.points !== a.points) return b.points - a.points
  const gdA = a.goalsFor - a.goalsAgainst
  const gdB = b.goalsFor - b.goalsAgainst
  if (gdB !== gdA) return gdB - gdA
  return b.goalsFor - a.goalsFor
}

function resolveRoute(
  route: string,
  resultsByGroup: Map<string, GroupResult>,
  top8BestThird: Array<{ teamId: string; groupName: string }>,
  usedBestThird: Set<string>,
  allGroupsComplete: boolean
): string | null {
  const winnerMatch = WINNER_RE.exec(route)
  if (winnerMatch) return resultsByGroup.get(winnerMatch[1])?.winner ?? null

  const runnerUpMatch = RUNNER_UP_RE.exec(route)
  if (runnerUpMatch) return resultsByGroup.get(runnerUpMatch[1])?.runnerUp ?? null

  const bestThirdMatch = BEST_THIRD_RE.exec(route)
  if (bestThirdMatch && allGroupsComplete) {
    const eligibleGroups = new Set(bestThirdMatch[1].split('/'))
    const pick = top8BestThird.find((e) => eligibleGroups.has(e.groupName) && !usedBestThird.has(e.teamId))
    if (pick) {
      usedBestThird.add(pick.teamId)
      return pick.teamId
    }
  }

  return null
}

export async function populateGroupQualifiers(): Promise<void> {
  const [
    { data: groupMatches, error: matchesError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('group_name, home_team_id, away_team_id, home_placeholder, away_placeholder, home_score, away_score, status')
      .eq('stage', 'GROUP')
      .not('group_name', 'is', null),
    supabaseAdmin.from('teams').select('id, name'),
  ])

  if (matchesError) throw new Error(matchesError.message)
  if (teamsError) throw new Error(teamsError.message)

  const teamIdByName = new Map<string, string>()
  for (const team of teams ?? []) {
    teamIdByName.set(team.name as string, team.id as string)
    const normalized = normalizeTeamName(team.name as string)
    if (normalized && !teamIdByName.has(normalized)) teamIdByName.set(normalized, team.id as string)
  }

  function resolveId(id: string | null, placeholder: string | null): string | null {
    if (id) return id
    const normalized = normalizeTeamName(placeholder)
    return normalized ? (teamIdByName.get(normalized) ?? null) : null
  }

  // Build per-group standings
  const groupStandings = new Map<string, Map<string, StandingEntry>>()
  const groupFinished = new Map<string, number>()

  for (const match of groupMatches ?? []) {
    const g = match.group_name as string
    const homeId = resolveId(match.home_team_id as string | null, match.home_placeholder as string | null)
    const awayId = resolveId(match.away_team_id as string | null, match.away_placeholder as string | null)

    if (!groupStandings.has(g)) groupStandings.set(g, new Map())
    const s = groupStandings.get(g)!

    for (const id of [homeId, awayId]) {
      if (id && !s.has(id)) {
        s.set(id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
      }
    }

    if (match.status !== 'finished' || match.home_score == null || match.away_score == null || !homeId || !awayId) continue

    const hs = match.home_score as number
    const as_ = match.away_score as number
    const homeRow = s.get(homeId)!
    const awayRow = s.get(awayId)!

    homeRow.played++
    homeRow.goalsFor += hs
    homeRow.goalsAgainst += as_
    awayRow.played++
    awayRow.goalsFor += as_
    awayRow.goalsAgainst += hs

    if (hs > as_) { homeRow.won++; awayRow.lost++ }
    else if (as_ > hs) { awayRow.won++; homeRow.lost++ }
    else { homeRow.drawn++; awayRow.drawn++ }

    homeRow.points = homeRow.won * 3 + homeRow.drawn
    awayRow.points = awayRow.won * 3 + awayRow.drawn

    groupFinished.set(g, (groupFinished.get(g) ?? 0) + 1)
  }

  // A 4-team group is complete after 6 finished matches
  const resultsByGroup = new Map<string, GroupResult>()
  for (const [g, standings] of groupStandings) {
    const sorted = Array.from(standings.values()).sort(compareStandings)
    const complete = (groupFinished.get(g) ?? 0) >= 6

    resultsByGroup.set(g, {
      winner: complete ? (sorted[0]?.teamId ?? null) : null,
      runnerUp: complete ? (sorted[1]?.teamId ?? null) : null,
      thirdPlace: complete ? (sorted[2]?.teamId ?? null) : null,
      thirdPlaceEntry: complete ? (sorted[2] ?? null) : null,
      complete,
    })
  }

  // Best-third ranking only available once all 12 groups are complete
  const allGroupsComplete = resultsByGroup.size >= 12 && Array.from(resultsByGroup.values()).every((r) => r.complete)

  const top8BestThird: Array<{ teamId: string; groupName: string }> = []
  if (allGroupsComplete) {
    const allThird = Array.from(resultsByGroup.entries())
      .filter(([, r]) => r.thirdPlace !== null)
      .map(([groupName, r]) => ({ teamId: r.thirdPlace!, groupName, entry: r.thirdPlaceEntry! }))
      .sort((a, b) => compareStandings(a.entry, b.entry) || a.groupName.localeCompare(b.groupName))
    top8BestThird.push(...allThird.slice(0, 8))
  }

  // Load R32 matches in kickoff order (same ordering bracket API uses)
  const { data: r32Matches, error: r32Error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team_id, away_team_id')
    .eq('stage', 'R32')
    .order('kickoff_utc', { ascending: true })

  if (r32Error) throw new Error(r32Error.message)
  if (!r32Matches?.length) return

  const r32Routes = BRACKET_ROUTES.R32 ?? []
  const usedBestThird = new Set<string>()

  for (let i = 0; i < r32Matches.length; i++) {
    const match = r32Matches[i]
    const route = r32Routes[i]
    if (!route) continue

    const curHome = match.home_team_id as string | null
    const curAway = match.away_team_id as string | null

    const newHome = curHome ?? resolveRoute(route.homeRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)
    const newAway = curAway ?? resolveRoute(route.awayRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)

    if (newHome === curHome && newAway === curAway) continue

    const { error } = await supabaseAdmin
      .from('matches')
      .update({ home_team_id: newHome, away_team_id: newAway })
      .eq('id', match.id)

    if (error) throw new Error(error.message)
  }
}
