import { getTierMultiplier } from '@/lib/domain'
import { applyMatchToProgress, emptyProgress, MatchProgressRow, TeamProgressState } from '@/lib/progress'
import { calculateBasePoints } from '@/lib/scoring'

export interface HistoryPlayerRow {
  id: string
  name: string
  colour: string
}

export interface HistoryPickRow {
  player_id: string
  team_id: string
  teams: {
    name: string
    tier: 1 | 2 | 3
  } | null
}

export interface HistoryMatchRow extends MatchProgressRow {
  id: string
  kickoff_utc: string
  group_name: string | null
}

export interface ScoreHistorySeries {
  entityId: string
  label: string
  colour: string
  totals: number[]
  ownerId?: string
  ownerName?: string
}

export interface MatchHistoryTeamImpact {
  teamId: string
  teamName: string
  ownerId: string | null
  ownerName: string | null
  ownerColour: string | null
  tier: 1 | 2 | 3 | null
  multiplier: number | null
  baseDelta: number
  pointsDelta: number
}

export interface MatchHistoryPlayerImpact {
  playerId: string
  name: string
  colour: string
  pointsDelta: number
  teams: Array<{
    teamId: string
    teamName: string
    baseDelta: number
    pointsDelta: number
    multiplier: number
  }>
}

export interface MatchHistoryEntry {
  id: string
  kickoffUtc: string
  date: string
  stage: string
  groupName: string | null
  homeTeamName: string | null
  awayTeamName: string | null
  homeScore: number | null
  awayScore: number | null
  teamImpacts: MatchHistoryTeamImpact[]
  playerImpacts: MatchHistoryPlayerImpact[]
}

export interface BuiltHistory {
  dates: string[]
  playerSeries: ScoreHistorySeries[]
  teamSeries: ScoreHistorySeries[]
  matches: MatchHistoryEntry[]
}

interface TeamOwnership {
  teamId: string
  teamName: string
  tier: 1 | 2 | 3
  multiplier: number
  playerId: string
  playerName: string
  playerColour: string
}

function cloneProgress(progress: TeamProgressState): TeamProgressState {
  return { ...progress }
}

function scoreTeam(progressByTeam: Map<string, TeamProgressState>, ownership: TeamOwnership): number {
  return calculateBasePoints(progressByTeam.get(ownership.teamId) ?? emptyProgress()) * ownership.multiplier
}

export function buildScoringHistory(
  players: HistoryPlayerRow[],
  picks: HistoryPickRow[],
  matches: HistoryMatchRow[],
  teamNamesById: Map<string, string>
): BuiltHistory {
  const ownershipByTeamId = new Map<string, TeamOwnership>()

  for (const pick of picks) {
    const player = players.find((row) => row.id === pick.player_id)
    if (!player || !pick.teams) continue

    ownershipByTeamId.set(pick.team_id, {
      teamId: pick.team_id,
      teamName: pick.teams.name,
      tier: pick.teams.tier,
      multiplier: getTierMultiplier(pick.teams.tier),
      playerId: player.id,
      playerName: player.name,
      playerColour: player.colour,
    })
  }

  const allTeamIds = new Set<string>([...teamNamesById.keys(), ...matches.flatMap((match) => [match.home_team_id, match.away_team_id]).filter(Boolean) as string[]])
  const progressByTeam = new Map<string, TeamProgressState>()

  for (const teamId of allTeamIds) {
    progressByTeam.set(teamId, emptyProgress())
  }

  const sortedMatches = [...matches].sort((left, right) => left.kickoff_utc.localeCompare(right.kickoff_utc))
  const dates: string[] = []
  const playerSeriesMap = new Map<string, number[]>()
  const teamSeriesMap = new Map<string, number[]>()
  const matchHistory: MatchHistoryEntry[] = []

  function snapshot(dateKey: string) {
    dates.push(dateKey)

    for (const player of players) {
      const total = picks
        .filter((pick) => pick.player_id === player.id)
        .reduce((sum, pick) => {
          const ownership = ownershipByTeamId.get(pick.team_id)
          if (!ownership) return sum
          return sum + scoreTeam(progressByTeam, ownership)
        }, 0)

      const existing = playerSeriesMap.get(player.id) ?? []
      existing.push(total)
      playerSeriesMap.set(player.id, existing)
    }

    for (const ownership of ownershipByTeamId.values()) {
      const existing = teamSeriesMap.get(ownership.teamId) ?? []
      existing.push(scoreTeam(progressByTeam, ownership))
      teamSeriesMap.set(ownership.teamId, existing)
    }
  }

  let currentDateKey = ''
  for (const match of sortedMatches) {
    const dateKey = match.kickoff_utc.slice(0, 10)
    if (currentDateKey && dateKey !== currentDateKey) {
      snapshot(currentDateKey)
    }
    currentDateKey = dateKey

    const relevantTeamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[]
    const beforeByTeamId = new Map<string, TeamProgressState>()
    for (const teamId of relevantTeamIds) {
      beforeByTeamId.set(teamId, cloneProgress(progressByTeam.get(teamId) ?? emptyProgress()))
    }

    applyMatchToProgress(progressByTeam, match)

    const teamImpacts: MatchHistoryTeamImpact[] = []
    const playerImpactMap = new Map<string, MatchHistoryPlayerImpact>()

    for (const teamId of relevantTeamIds) {
      const before = beforeByTeamId.get(teamId) ?? emptyProgress()
      const after = progressByTeam.get(teamId) ?? emptyProgress()
      const baseDelta = calculateBasePoints(after) - calculateBasePoints(before)
      const ownership = ownershipByTeamId.get(teamId)

      const teamImpact: MatchHistoryTeamImpact = {
        teamId,
        teamName: ownership?.teamName ?? teamNamesById.get(teamId) ?? 'Unknown',
        ownerId: ownership?.playerId ?? null,
        ownerName: ownership?.playerName ?? null,
        ownerColour: ownership?.playerColour ?? null,
        tier: ownership?.tier ?? null,
        multiplier: ownership?.multiplier ?? null,
        baseDelta,
        pointsDelta: ownership ? baseDelta * ownership.multiplier : 0,
      }

      teamImpacts.push(teamImpact)

      if (!ownership) continue

      const existing = playerImpactMap.get(ownership.playerId) ?? {
        playerId: ownership.playerId,
        name: ownership.playerName,
        colour: ownership.playerColour,
        pointsDelta: 0,
        teams: [],
      }

      existing.pointsDelta += teamImpact.pointsDelta
      existing.teams.push({
        teamId,
        teamName: teamImpact.teamName,
        baseDelta,
        pointsDelta: teamImpact.pointsDelta,
        multiplier: ownership.multiplier,
      })
      playerImpactMap.set(ownership.playerId, existing)
    }

    matchHistory.push({
      id: match.id,
      kickoffUtc: match.kickoff_utc,
      date: dateKey,
      stage: match.stage,
      groupName: match.group_name,
      homeTeamName: match.home_team_id ? (teamNamesById.get(match.home_team_id) ?? null) : null,
      awayTeamName: match.away_team_id ? (teamNamesById.get(match.away_team_id) ?? null) : null,
      homeScore: match.home_score,
      awayScore: match.away_score,
      teamImpacts,
      playerImpacts: Array.from(playerImpactMap.values()).sort((left, right) => right.pointsDelta - left.pointsDelta),
    })
  }

  if (currentDateKey) {
    snapshot(currentDateKey)
  }

  const playerSeries = players.map((player) => ({
    entityId: player.id,
    label: player.name,
    colour: player.colour,
    totals: playerSeriesMap.get(player.id) ?? new Array(dates.length).fill(0),
  }))

  const teamSeries = Array.from(ownershipByTeamId.values())
    .sort((left, right) => left.teamName.localeCompare(right.teamName))
    .map((ownership) => ({
      entityId: ownership.teamId,
      label: ownership.teamName,
      colour: ownership.playerColour,
      ownerId: ownership.playerId,
      ownerName: ownership.playerName,
      totals: teamSeriesMap.get(ownership.teamId) ?? new Array(dates.length).fill(0),
    }))

  return {
    dates,
    playerSeries,
    teamSeries,
    matches: matchHistory,
  }
}
