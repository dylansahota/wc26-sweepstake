import { supabaseAdmin } from '@/lib/supabase'
import { normalizeTeamName } from '@/lib/team-names'

export interface MatchProgressRow {
  stage: string
  status: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  winner_team_id: string | null
}

export interface TeamProgressState {
  group_wins: number
  group_draws: number
  qualified_r32: boolean
  qualified_r16: boolean
  reached_qf: boolean
  reached_sf: boolean
  reached_final: boolean
  won_tournament: boolean
}

export function emptyProgress(): TeamProgressState {
  return {
    group_wins: 0,
    group_draws: 0,
    qualified_r32: false,
    qualified_r16: false,
    reached_qf: false,
    reached_sf: false,
    reached_final: false,
    won_tournament: false,
  }
}

function markReached(progress: TeamProgressState, stage: string) {
  if (stage === 'R32') {
    progress.qualified_r32 = true
  } else if (stage === 'R16') {
    progress.qualified_r32 = true
    progress.qualified_r16 = true
  } else if (stage === 'QF') {
    progress.qualified_r32 = true
    progress.qualified_r16 = true
    progress.reached_qf = true
  } else if (stage === 'SF') {
    progress.qualified_r32 = true
    progress.qualified_r16 = true
    progress.reached_qf = true
    progress.reached_sf = true
  } else if (stage === 'FINAL') {
    progress.qualified_r32 = true
    progress.qualified_r16 = true
    progress.reached_qf = true
    progress.reached_sf = true
    progress.reached_final = true
  }
}

export function applyMatchToProgress(
  progressByTeam: Map<string, TeamProgressState>,
  match: MatchProgressRow
): void {
  if (match.status !== 'finished') return

  const homeId = match.home_team_id
  const awayId = match.away_team_id

  if (match.stage === 'GROUP') {
    if (!homeId || !awayId || match.home_score == null || match.away_score == null) return

    const home = progressByTeam.get(homeId)
    const away = progressByTeam.get(awayId)
    if (!home || !away) return

    if (match.home_score > match.away_score) {
      home.group_wins += 1
    } else if (match.away_score > match.home_score) {
      away.group_wins += 1
    } else {
      home.group_draws += 1
      away.group_draws += 1
    }
    return
  }

  if (homeId) {
    const home = progressByTeam.get(homeId)
    if (home) markReached(home, match.stage)
  }
  if (awayId) {
    const away = progressByTeam.get(awayId)
    if (away) markReached(away, match.stage)
  }

  if (match.stage === 'FINAL' && match.winner_team_id) {
    const champion = progressByTeam.get(match.winner_team_id)
    if (champion) {
      champion.qualified_r32 = true
      champion.qualified_r16 = true
      champion.reached_qf = true
      champion.reached_sf = true
      champion.reached_final = true
      champion.won_tournament = true
    }
  }
}

async function reconcileMatchTeamReferences(): Promise<void> {
  const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name'),
    supabaseAdmin.from('matches').select('id, home_team_id, away_team_id, home_placeholder, away_placeholder'),
  ])

  if (teamsError) throw new Error(teamsError.message)
  if (matchesError) throw new Error(matchesError.message)

  const teamIdByName = new Map<string, string>()
  for (const team of teams ?? []) {
    const teamName = team.name as string
    teamIdByName.set(teamName, team.id as string)

    const normalized = normalizeTeamName(teamName)
    if (normalized && !teamIdByName.has(normalized)) {
      teamIdByName.set(normalized, team.id as string)
    }
  }

  for (const match of matches ?? []) {
    const homePlaceholder = normalizeTeamName(match.home_placeholder as string | null)
    const awayPlaceholder = normalizeTeamName(match.away_placeholder as string | null)

    const homeTeamId = (match.home_team_id as string | null) ?? (homePlaceholder ? teamIdByName.get(homePlaceholder) ?? null : null)
    const awayTeamId = (match.away_team_id as string | null) ?? (awayPlaceholder ? teamIdByName.get(awayPlaceholder) ?? null : null)

    const shouldUpdateHome = homeTeamId !== (match.home_team_id as string | null)
    const shouldUpdateAway = awayTeamId !== (match.away_team_id as string | null)
    const shouldNormalizeHome = homePlaceholder !== (match.home_placeholder as string | null)
    const shouldNormalizeAway = awayPlaceholder !== (match.away_placeholder as string | null)

    if (!shouldUpdateHome && !shouldUpdateAway && !shouldNormalizeHome && !shouldNormalizeAway) continue

    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_placeholder: homeTeamId ? null : homePlaceholder,
        away_placeholder: awayTeamId ? null : awayPlaceholder,
      })
      .eq('id', match.id)

    if (updateError) throw new Error(updateError.message)
  }
}

export async function recalculateTeamProgressFromMatches(): Promise<void> {
  await reconcileMatchTeamReferences()

  const [{ data: teams, error: teamsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabaseAdmin.from('teams').select('id'),
    supabaseAdmin
      .from('matches')
      .select('stage, status, home_team_id, away_team_id, home_score, away_score, winner_team_id')
      .order('kickoff_utc', { ascending: true }),
  ])

  if (teamsError) throw new Error(teamsError.message)
  if (matchesError) throw new Error(matchesError.message)

  const progressByTeam = new Map<string, TeamProgressState>()
  for (const team of teams ?? []) {
    progressByTeam.set(team.id as string, emptyProgress())
  }

  for (const match of (matches ?? []) as MatchProgressRow[]) {
    applyMatchToProgress(progressByTeam, match)
  }

  const rows = Array.from(progressByTeam.entries()).map(([teamId, progress]) => ({
    team_id: teamId,
    ...progress,
  }))

  const { error } = await supabaseAdmin.from('team_progress').upsert(rows, { onConflict: 'team_id' })
  if (error) throw new Error(error.message)
}
