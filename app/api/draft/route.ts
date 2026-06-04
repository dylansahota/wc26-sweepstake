import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import {
  getCurrentPickIndex,
  getCurrentPlayerId,
  getDraftPicks,
  getDraftState,
  getPlayers,
  getRoundNumber,
  getTakenTeamIds,
  getTeams,
  maxPicks,
} from '@/lib/draft'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const players = await getPlayers()
  const playerOrder = await getDraftState(players)
  const picks = await getDraftPicks()
  const teams = await getTeams()
  const taken = await getTakenTeamIds()
  const teamsById = new Map(teams.map((team) => [team.id, team]))

  const currentPickIndex = getCurrentPickIndex(picks.length)
  const currentPlayerId = getCurrentPlayerId(playerOrder, picks.length)
  const isComplete = picks.length >= maxPicks()

  return NextResponse.json({
    players,
    playerOrder,
    picks: picks.map((pick) => ({
      ...pick,
      teams: pick.team_id ? teamsById.get(pick.team_id) ?? pick.teams ?? null : pick.teams ?? null,
    })),
    teams,
    availableTeams: teams.filter((team) => !taken.has(team.id)),
    currentPickIndex,
    currentRound: isComplete ? null : getRoundNumber(picks.length),
    currentPlayerId: isComplete ? null : currentPlayerId,
    maxPicks: maxPicks(),
    isComplete,
  })
}
