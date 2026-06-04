import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret')
const PROTECTED = ['/draft', '/leaderboard', '/bracket', '/admin']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!PROTECTED.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('wc26sw_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (pathname.startsWith('/admin')) {
      const name = typeof payload.name === 'string' ? payload.name : ''
      if (name.trim().toLowerCase() !== 'dylan') {
        return NextResponse.redirect(new URL('/draft', req.url))
      }
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/', req.url))
  }
}

export const config = {
  matcher: ['/draft/:path*', '/leaderboard/:path*', '/bracket/:path*', '/admin/:path*'],
}
