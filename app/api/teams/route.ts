import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, code, tier, draft_picks(player_id, players(id, name, colour))')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ teams: data ?? [] })
}
