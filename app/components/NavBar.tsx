'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

function IconDraft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconLeaderboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

function IconGroups() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function IconBracket() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h5"/>
      <path d="M3 18h5"/>
      <path d="M8 6v3a2 2 0 0 0 2 2h1"/>
      <path d="M8 18v-3a2 2 0 0 1 2-2h1"/>
      <path d="M11 11h4"/>
      <rect x="15" y="8" width="6" height="6" rx="1"/>
    </svg>
  )
}

function IconResults() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}

function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

const MOBILE_TABS = [
  { href: '/draft', label: 'Draft', Icon: IconDraft },
  { href: '/leaderboard', label: 'Standings', Icon: IconLeaderboard },
  { href: '/groups', label: 'Groups', Icon: IconGroups },
  { href: '/bracket', label: 'Bracket', Icon: IconBracket },
  { href: '/results', label: 'Results', Icon: IconResults },
]

const DESKTOP_LINKS = [
  { href: '/draft', label: 'Draft' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/groups', label: 'Groups' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/results', label: 'Results' },
  { href: '/points', label: 'Points' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

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

  const desktopLinks = useMemo(
    () => DESKTOP_LINKS.filter((link) => link.href !== '/admin' || isAdmin),
    [isAdmin],
  )

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <nav className="nav-shell nav-desktop-only">
        <div className="nav-links">
          {desktopLinks.map((link) => {
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

      <nav className="bottom-tab-bar">
        {MOBILE_TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={active ? 'tab-item active' : 'tab-item'}>
              <Icon />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className={moreOpen ? 'tab-item active' : 'tab-item'}
          onClick={() => setMoreOpen(true)}
        >
          <IconMore />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="more-overlay" onClick={() => setMoreOpen(false)} />
          <div className="more-menu">
            <Link
              href="/points"
              className={pathname.startsWith('/points') ? 'more-menu-link active' : 'more-menu-link'}
              onClick={() => setMoreOpen(false)}
            >
              Points
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={pathname.startsWith('/admin') ? 'more-menu-link active' : 'more-menu-link'}
                onClick={() => setMoreOpen(false)}
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              className="more-menu-link more-menu-logout"
              onClick={async () => {
                setMoreOpen(false)
                await logout()
              }}
            >
              Logout
            </button>
          </div>
        </>
      )}
    </>
  )
}
