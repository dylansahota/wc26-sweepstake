import { normalizeTeamName } from './team-names'

export const DRAFT_ROUNDS = 9
export const PLAYERS_COUNT = 5

export const TIER_1_TEAMS = [
  'France',
  'Argentina',
  'Spain',
  'England',
  'Portugal',
  'Brazil',
  'Morocco',
  'Netherlands',
] as const

export const TIER_2_TEAMS = [
  'Belgium',
  'Germany',
  'Croatia',
  'Colombia',
  'Senegal',
  'Mexico',
  'USA',
  'Uruguay',
  'Japan',
  'Switzerland',
  'Iran',
  'Turkey',
  'Austria',
  'Ecuador',
  'South Korea',
  'Australia',
  'Algeria',
  'Egypt',
  'Canada',
  'Norway',
] as const

export type Tier = 1 | 2 | 3

export function getTierForTeam(teamName: string): Tier {
  const normalized = normalizeTeamName(teamName) ?? teamName
  if (TIER_1_TEAMS.includes(normalized as (typeof TIER_1_TEAMS)[number])) {
    return 1
  }
  if (TIER_2_TEAMS.includes(normalized as (typeof TIER_2_TEAMS)[number])) {
    return 2
  }
  return 3
}

export function getTierMultiplier(tier: Tier): number {
  if (tier === 1) return 1
  if (tier === 2) return 1.5
  return 2
}

export function buildSnakeOrder(playerIds: string[], rounds = DRAFT_ROUNDS): string[] {
  const picks: string[] = []
  for (let round = 1; round <= rounds; round += 1) {
    const order = round % 2 === 1 ? playerIds : [...playerIds].reverse()
    picks.push(...order)
  }
  return picks
}

export function getRoundFromPick(overallPick: number): number {
  return Math.floor((overallPick - 1) / PLAYERS_COUNT) + 1
}
