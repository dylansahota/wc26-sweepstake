import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { clearSession, createSession, getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface LoginBody {
  name?: string
  pin?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LoginBody
  const name = body.name?.trim()
  const pin = body.pin?.trim()

  if (!name || !pin) {
    return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 })
  }

  const { data: player, error } = await supabaseAdmin
    .from('players')
    .select('id, name, colour, pin_hash')
    .ilike('name', name)
    .single()

  if (error || !player) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const matches = await bcrypt.compare(pin, player.pin_hash)
  if (!matches) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const res = NextResponse.json({
    player: { id: player.id, name: player.name, colour: player.colour },
  })
  await createSession(res, { id: player.id, name: player.name, colour: player.colour })
  return res
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ session: null })
  }
  return NextResponse.json({ session })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  await clearSession(res)
  return res
}
