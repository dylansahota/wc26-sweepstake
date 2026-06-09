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

  let body: { order?: unknown } = {}
  try {
    body = (await req.json()) as { order?: unknown }
  } catch {
    // no body or invalid JSON — fall back to random
  }

  let playerOrder: string[]

  if (Array.isArray(body.order)) {
    const provided = body.order as unknown[]
    const validIds = new Set(players.map((p) => p.id))

    // Validate every entry is a known player ID
    for (const id of provided) {
      if (typeof id !== 'string' || !validIds.has(id)) {
        return NextResponse.json(
          { error: `Invalid player id in order: ${String(id)}` },
          { status: 400 }
        )
      }
    }

    // Validate the array covers all players exactly once
    if (provided.length !== players.length || new Set(provided).size !== players.length) {
      return NextResponse.json(
        { error: 'order must contain each player id exactly once' },
        { status: 400 }
      )
    }

    playerOrder = provided as string[]
  } else {
    playerOrder = shuffle(players.map((p) => p.id))
  }

  await setDraftState(playerOrder)

  return NextResponse.json({
    ok: true,
    playerOrder,
  })
}
