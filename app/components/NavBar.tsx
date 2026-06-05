'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const LINKS = [
  { href: '/draft', label: 'Draft' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/groups', label: 'Groups' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/points', label: 'Points' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const response = await fetch('/api/auth/session', { cache: 'no-store' })
      const payload = (await response.json()) as { session?: { name?: string } | null }
      if (!active) return

      const sessionName = payload.session?.name?.trim().toLowerCase() ?? ''
      setIsAdmin(sessionName === 'dylan')
    }

    void loadSession()
    return () => {
      active = false
    }
  }, [])

  const visibleLinks = useMemo(() => {
    return LINKS.filter((link) => link.href !== '/admin' || isAdmin)
  }, [isAdmin])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="nav-shell">
      <div className="nav-links">
        {visibleLinks.map((link) => {
          const active = pathname.startsWith(link.href)
          return (
            <Link key={link.href} href={link.href} className={active ? 'nav-link active' : 'nav-link'}>
              {link.label}
            </Link>
          )
        })}
      </div>
      <button type="button" onClick={logout} className="ghost-btn">
        Logout
      </button>
    </nav>
  )
}
