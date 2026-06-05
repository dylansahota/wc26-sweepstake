import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { syncMatchesFromFootballData } from '@/lib/football-data'
import { recalculateTeamProgressFromMatches } from '@/lib/progress'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const cronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!cronAuthorized) {
    const admin = await requireAdmin(req)
    if (!admin.ok) return admin.response
  }

  const syncedMatches = await syncMatchesFromFootballData()
  await recalculateTeamProgressFromMatches()

  return NextResponse.json({ ok: true, syncedMatches })
}
