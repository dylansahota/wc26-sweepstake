import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'wc26sw_session'

export interface SessionPayload {
  id: string
  name: string
  colour: string
}

export async function createSession(res: NextResponse, payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(SECRET)
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function clearSession(res: NextResponse) {
  res.cookies.delete(COOKIE)
}
