import { buildSnakeOrder, DRAFT_ROUNDS, getRoundFromPick, PLAYERS_COUNT } from '@/lib/domain'
import { supabaseAdmin } from '@/lib/supabase'
import { getWorldRanking } from '@/lib/team-metadata'

interface PlayerRow {
  id: string
  name: string
  colour: string
}

interface TeamRow {
  id: string
  name: string
  code: string | null
  tier: 1 | 2 | 3
  ranking: number | null
  groupName: string | null
  squad: SquadMemberRow[]
}

interface SquadMemberRow {
  id: string
  name: string
  position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD' | 'MANAGER'
  squad_role: 'player' | 'manager'
  shirt_number: number | null
}

interface SquadMemberQueryRow extends SquadMemberRow {
  team_id: string
}

interface DraftStateRow {
  id: number
  player_order: string[]
}

export async function getPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabaseAdmin.from('players').select('id, name, colour').order('name')
  if (error || !data) return []
  return data as PlayerRow[]
}

export async function getDraftState(players: PlayerRow[]): Promise<string[]> {
  const { data } = await supabaseAdmin.from('draft_state').select('id, player_order').eq('id', 1).maybeSingle()
  const draftState = data as DraftStateRow | null
  if (draftState?.player_order?.length === PLAYERS_COUNT) {
    return draftState.player_order
  }
  const fallbackOrder = players.map((p) => p.id)
  await supabaseAdmin.from('draft_state').upsert({ id: 1, player_order: fallbackOrder })
  return fallbackOrder
}

export async function setDraftState(order: string[]): Promise<void> {
  await supabaseAdmin.from('draft_state').upsert({ id: 1, player_order: order })
}

export async function getDraftPicks() {
  const { data } = await supabaseAdmin
    .from('draft_picks')
    .select('id, overall_pick, round, player_id, team_id, created_at, players(name, colour), teams(name, code, tier)')
    .order('overall_pick', { ascending: true })
  return data ?? []
}

async function getAllSquadMembers(): Promise<SquadMemberQueryRow[]> {
  const rows: SquadMemberQueryRow[] = []
  const pageSize = 500

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await supabaseAdmin
      .from('team_squad_members')
      .select('id, team_id, name, position, squad_role, shirt_number')
      .order('team_id', { ascending: true })
      .order('squad_role', { ascending: true })
      .order('position', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    const page = (data ?? []) as SquadMemberQueryRow[]
    rows.push(...page)

    if (page.length < pageSize) {
      break
    }
  }

  return rows
}

export async function getTeams() {
  const [{ data: teams }, { data: matches }, squadMembers] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name, code, tier'),
    supabaseAdmin
      .from('matches')
      .select('group_name, home_team_id, away_team_id')
      .eq('stage', 'GROUP')
      .not('group_name', 'is', null),
    getAllSquadMembers(),
  ])

  const groupByTeamId = new Map<string, string>()
  const squadByTeamId = new Map<string, SquadMemberRow[]>()

  for (const member of squadMembers ?? []) {
    const teamId = member.team_id as string
    const existing = squadByTeamId.get(teamId) ?? []
    existing.push({
      id: member.id as string,
      name: member.name as string,
      position: member.position as SquadMemberRow['position'],
      squad_role: member.squad_role as SquadMemberRow['squad_role'],
      shirt_number: (member.shirt_number as number | null) ?? null,
    })
    squadByTeamId.set(teamId, existing)
  }

  for (const match of matches ?? []) {
    const groupName = match.group_name as string | null
    if (!groupName) continue

    const homeTeamId = match.home_team_id as string | null
    const awayTeamId = match.away_team_id as string | null

    if (homeTeamId && !groupByTeamId.has(homeTeamId)) {
      groupByTeamId.set(homeTeamId, groupName)
    }
    if (awayTeamId && !groupByTeamId.has(awayTeamId)) {
      groupByTeamId.set(awayTeamId, groupName)
    }
  }

  return ((teams ?? []) as Omit<TeamRow, 'ranking' | 'groupName' | 'squad'>[])
    .map((team) => ({
      ...team,
      ranking: getWorldRanking(team.name),
      groupName: groupByTeamId.get(team.id) ?? null,
      squad: squadByTeamId.get(team.id) ?? [],
    }))
    .sort((left, right) => {
      if (left.ranking == null && right.ranking == null) return left.name.localeCompare(right.name)
      if (left.ranking == null) return 1
      if (right.ranking == null) return -1
      if (left.ranking !== right.ranking) return left.ranking - right.ranking
      return left.name.localeCompare(right.name)
    })
}

export async function getTakenTeamIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from('draft_picks').select('team_id')
  return new Set((data ?? []).map((row) => row.team_id as string))
}

export function getSnakeOrder(playerOrder: string[]): string[] {
  return buildSnakeOrder(playerOrder, DRAFT_ROUNDS)
}

export function getCurrentPickIndex(totalPicksMade: number): number {
  return totalPicksMade
}

export function getCurrentPlayerId(playerOrder: string[], totalPicksMade: number): string | null {
  const order = getSnakeOrder(playerOrder)
  return order[totalPicksMade] ?? null
}

export function getRoundNumber(totalPicksMade: number): number {
  return getRoundFromPick(totalPicksMade + 1)
}

export function maxPicks(): number {
  return DRAFT_ROUNDS * PLAYERS_COUNT
}
