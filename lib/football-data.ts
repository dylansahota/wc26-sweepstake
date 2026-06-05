import { createClient } from '@supabase/supabase-js'
import { normalizeTeamName } from '@/lib/team-names'

function mapStage(stage: string | undefined): string {
  if (!stage) return 'GROUP'
  if (stage === 'GROUP_STAGE') return 'GROUP'
  if (stage === 'LAST_32') return 'R32'
  if (stage === 'LAST_16') return 'R16'
  if (stage === 'QUARTER_FINALS') return 'QF'
  if (stage === 'SEMI_FINALS') return 'SF'
  if (stage === 'FINAL') return 'FINAL'
  if (stage === 'THIRD_PLACE') return 'THIRD_PLACE'
  return 'GROUP'
}

function mapGroup(group: string | undefined): string | null {
  if (!group) return null
  if (group.startsWith('GROUP_')) return group.replace('GROUP_', '')
  return group
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncMatchesFromFootballData(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!url || !serviceRole) {
    throw new Error('Missing Supabase env vars')
  }

  if (!apiKey) {
    throw new Error('Missing FOOTBALL_DATA_API_KEY')
  }

  const supabase = createClient(url, serviceRole)
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name')
  if (teamsError) throw new Error(teamsError.message)

  const teamIdByName = new Map((teams ?? []).map((team) => [team.name as string, team.id as string]))
  const response = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': apiKey },
  })

  if (!response.ok) {
    throw new Error(`football-data request failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    matches?: Array<{
      id: number
      utcDate: string
      status: string
      stage?: string
      group?: string
      homeTeam?: { name?: string }
      awayTeam?: { name?: string }
      score?: {
        winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
        fullTime?: { home?: number | null; away?: number | null }
      }
    }>
  }

  const rows = (payload.matches ?? [])
    .filter((match) => match.utcDate.startsWith('2026'))
    .map((match) => {
      const homeName = normalizeTeamName(match.homeTeam?.name)
      const awayName = normalizeTeamName(match.awayTeam?.name)
      const homeTeamId = homeName ? teamIdByName.get(homeName) ?? null : null
      const awayTeamId = awayName ? teamIdByName.get(awayName) ?? null : null

      let winnerTeamId: string | null = null
      if (match.score?.winner === 'HOME_TEAM') winnerTeamId = homeTeamId
      if (match.score?.winner === 'AWAY_TEAM') winnerTeamId = awayTeamId

      return {
        fd_id: match.id,
        stage: mapStage(match.stage),
        group_name: mapGroup(match.group),
        kickoff_utc: match.utcDate,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_placeholder: homeTeamId ? null : homeName,
        away_placeholder: awayTeamId ? null : awayName,
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        winner_team_id: winnerTeamId,
        status: match.status === 'FINISHED' ? 'finished' : 'scheduled',
      }
    })

  const chunkSize = 25
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const { error } = await supabase.from('matches').upsert(chunk, { onConflict: 'fd_id' })
    if (error) throw new Error(error.message)

    if (index + chunkSize < rows.length) {
      await sleep(7000)
    }
  }

  return rows.length
}
