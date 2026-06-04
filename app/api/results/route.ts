import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSession } from '@/lib/api-auth'
import { recalculateTeamProgressFromMatches } from '@/lib/progress'
import { supabaseAdmin } from '@/lib/supabase'

interface ResultBody {
  teamId?: string
  group_wins?: number
  group_draws?: number
  qualified_r32?: boolean
  qualified_r16?: boolean
  reached_qf?: boolean
  reached_sf?: boolean
  reached_final?: boolean
  won_tournament?: boolean
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    await recalculateTeamProgressFromMatches()
    return NextResponse.json({ ok: true, mode: 'cron-recalculated' })
  }

  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select(
      'id, name, code, tier, team_progress(group_wins, group_draws, qualified_r32, qualified_r16, reached_qf, reached_sf, reached_final, won_tournament)'
    )
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ teams: data ?? [] })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const cronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!cronAuthorized) {
    const admin = await requireAdmin(req)
    if (!admin.ok) return admin.response
  }

  if (!req.headers.get('content-type')?.includes('application/json')) {
    await recalculateTeamProgressFromMatches()
    return NextResponse.json({ ok: true, mode: 'recalculated' })
  }

  const body = (await req.json()) as ResultBody
  if (!body.teamId) {
    await recalculateTeamProgressFromMatches()
    return NextResponse.json({ ok: true, mode: 'recalculated' })
  }

  const payload = {
    team_id: body.teamId,
    group_wins: body.group_wins ?? 0,
    group_draws: body.group_draws ?? 0,
    qualified_r32: body.qualified_r32 ?? false,
    qualified_r16: body.qualified_r16 ?? false,
    reached_qf: body.reached_qf ?? false,
    reached_sf: body.reached_sf ?? false,
    reached_final: body.reached_final ?? false,
    won_tournament: body.won_tournament ?? false,
  }

  const { error } = await supabaseAdmin.from('team_progress').upsert(payload, { onConflict: 'team_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recalculateTeamProgressFromMatches()
  return NextResponse.json({ ok: true })
}
