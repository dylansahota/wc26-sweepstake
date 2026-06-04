import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

function isAdminName(name: string): boolean {
  return name.trim().toLowerCase() === 'dylan'
}

export async function requireSession(req: NextRequest): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession(req)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, session }
}

export async function requireAdmin(req: NextRequest): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireSession(req)
  if (!auth.ok) return auth
  if (!isAdminName(auth.session.name)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin only' }, { status: 403 }),
    }
  }
  return auth
}
