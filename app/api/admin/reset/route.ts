import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const { error: picksError } = await supabaseAdmin.from('draft_picks').delete().gt('overall_pick', 0)
  if (picksError) {
    return NextResponse.json({ error: picksError.message }, { status: 500 })
  }

  const { error: stateError } = await supabaseAdmin.from('draft_state').delete().eq('id', 1)
  if (stateError) {
    return NextResponse.json({ error: stateError.message }, { status: 500 })
  }

  const { error: progressError } = await supabaseAdmin.from('team_progress').delete().not('team_id', 'is', null)
  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 })
  }

  const { error: matchesError } = await supabaseAdmin
    .from('matches')
    .update({
      home_score: null,
      away_score: null,
      winner_team_id: null,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .not('id', 'is', null)

  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
