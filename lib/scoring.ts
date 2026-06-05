export interface TeamProgress {
  team_id?: string
  team_name?: string
  tier?: 1 | 2 | 3
  group_wins: number
  group_draws: number
  qualified_r32: boolean
  qualified_r16: boolean
  reached_qf: boolean
  reached_sf: boolean
  reached_final: boolean
  won_tournament: boolean
}

export const THIRD_PLACE_WIN_BASE_POINTS = 2

export interface ThirdPlaceMatchBonusRow {
  stage: string
  status: string
  home_team_id: string | null
  away_team_id: string | null
  winner_team_id: string | null
}

export function buildThirdPlaceBonusByTeam(matches: ThirdPlaceMatchBonusRow[]): Map<string, number> {
  const bonusByTeam = new Map<string, number>()

  for (const match of matches) {
    if (match.stage !== 'THIRD_PLACE' || match.status !== 'finished') continue

    const homeId = match.home_team_id
    const awayId = match.away_team_id
    const winnerId = match.winner_team_id

    if (!homeId || !awayId || !winnerId) continue

    bonusByTeam.set(winnerId, (bonusByTeam.get(winnerId) ?? 0) + THIRD_PLACE_WIN_BASE_POINTS)
  }

  return bonusByTeam
}

export function calculateBasePoints(p: TeamProgress): number {
  let pts = 0
  pts += p.group_wins * 4
  pts += p.group_draws * 2
  if (p.qualified_r32) pts += 4
  if (p.qualified_r16) pts += 5
  if (p.reached_qf) pts += 7
  if (p.reached_sf) pts += 9
  if (p.reached_final) pts += 11
  if (p.won_tournament) pts += 15
  return pts
}

export function calculateTeamPoints(p: TeamProgress, multiplier: number): number {
  return calculateBasePoints(p) * multiplier
}

export function getKnockoutRoundsReached(p: TeamProgress): number {
  if (p.won_tournament) return 5
  if (p.reached_final) return 4
  if (p.reached_sf) return 3
  if (p.reached_qf) return 2
  if (p.qualified_r16) return 1
  if (p.qualified_r32) return 0
  return -1
}

export interface TeamScoreBreakdown {
  basePoints: number
  multiplier: number
  totalPoints: number
}

export function buildTeamScoreBreakdown(
  p: TeamProgress,
  multiplier: number,
  extraBasePoints = 0
): TeamScoreBreakdown {
  const basePoints = calculateBasePoints(p) + extraBasePoints
  return {
    basePoints,
    multiplier,
    totalPoints: basePoints * multiplier,
  }
}
