import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase'

interface Body {
  pickId?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as Body
  if (!body.pickId) {
    return NextResponse.json({ error: 'pickId is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('draft_picks')
    .delete()
    .eq('id', body.pickId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
