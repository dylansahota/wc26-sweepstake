'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/draft', label: 'Draft' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/admin', label: 'Admin' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="nav-shell">
      <div className="nav-links">
        {LINKS.map((link) => {
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
