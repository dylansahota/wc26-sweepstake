import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import {
  getCurrentPlayerId,
  getDraftPicks,
  getDraftState,
  getPlayers,
  getRoundNumber,
  getTakenTeamIds,
  maxPicks,
} from '@/lib/draft'
import { supabaseAdmin } from '@/lib/supabase'

interface PickBody {
  teamId?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as PickBody
  if (!body.teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
  }

  const players = await getPlayers()
  const playerOrder = await getDraftState(players)
  const picks = await getDraftPicks()

  if (picks.length >= maxPicks()) {
    return NextResponse.json({ error: 'Draft is complete' }, { status: 400 })
  }

  const expectedPlayerId = getCurrentPlayerId(playerOrder, picks.length)
  if (expectedPlayerId !== auth.session.id) {
    return NextResponse.json({ error: 'Not your turn' }, { status: 403 })
  }

  const taken = await getTakenTeamIds()
  if (taken.has(body.teamId)) {
    return NextResponse.json({ error: 'Team already drafted' }, { status: 409 })
  }

  const overallPick = picks.length + 1
  const round = getRoundNumber(picks.length)

  const { error } = await supabaseAdmin.from('draft_picks').insert({
    overall_pick: overallPick,
    round,
    player_id: auth.session.id,
    team_id: body.teamId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
