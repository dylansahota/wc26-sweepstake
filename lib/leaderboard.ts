import { getTierMultiplier } from '@/lib/domain'
import { buildTeamScoreBreakdown, TeamProgress } from '@/lib/scoring'

export interface PlayerSummary {
  id: string
  name: string
  colour: string
  totalPoints: number
  teams: Array<{
    teamId: string
    teamName: string
    tier: 1 | 2 | 3
    basePoints: number
    multiplier: number
    totalPoints: number
    progress: TeamProgress
  }>
}

export interface PlayerRow {
  id: string
  name: string
  colour: string
}

export interface PickRow {
  player_id: string
  team_id: string
  teams: {
    name: string
    tier: 1 | 2 | 3
  } | null
}

export interface ProgressRow {
  team_id: string
  group_wins: number
  group_draws: number
  qualified_r32: boolean
  qualified_r16: boolean
  reached_qf: boolean
  reached_sf: boolean
  reached_final: boolean
  won_tournament: boolean
}

function emptyProgress(teamId: string): TeamProgress {
  return {
    team_id: teamId,
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

export function buildLeaderboard(
  players: PlayerRow[],
  picks: PickRow[],
  progressRows: ProgressRow[]
): PlayerSummary[] {
  const progressByTeam = new Map(progressRows.map((row) => [row.team_id, row]))

  const summaries = players.map((player) => {
    const playerPicks = picks.filter((pick) => pick.player_id === player.id)
    const teams = playerPicks.map((pick) => {
      const tier = pick.teams?.tier ?? 3
      const progress = progressByTeam.get(pick.team_id) ?? emptyProgress(pick.team_id)
      const multiplier = getTierMultiplier(tier)
      const score = buildTeamScoreBreakdown(progress, multiplier)

      return {
        teamId: pick.team_id,
        teamName: pick.teams?.name ?? 'Unknown',
        tier,
        basePoints: score.basePoints,
        multiplier,
        totalPoints: score.totalPoints,
        progress,
      }
    })

    const totalPoints = teams.reduce((sum, team) => sum + team.totalPoints, 0)
    return {
      id: player.id,
      name: player.name,
      colour: player.colour,
      totalPoints,
      teams,
    }
  })

  return summaries.sort((a, b) => b.totalPoints - a.totalPoints)
}
