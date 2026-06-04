import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getPlayers, setDraftState } from '@/lib/draft'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const players = await getPlayers()
  if (players.length === 0) {
    return NextResponse.json({ error: 'No players found. Seed players first.' }, { status: 400 })
  }

  const randomized = shuffle(players.map((p) => p.id))
  await setDraftState(randomized)

  return NextResponse.json({
    ok: true,
    playerOrder: randomized,
  })
}
