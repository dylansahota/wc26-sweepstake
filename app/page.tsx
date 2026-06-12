'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((payload: { session?: unknown }) => {
        if (payload.session) {
          router.replace('/leaderboard')
        }
      })
  }, [router])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    })
    const payload = (await res.json()) as { error?: string }
    setSubmitting(false)

    if (!res.ok) {
      setError(payload.error ?? 'Login failed')
      return
    }

    setError('')
    router.push('/leaderboard')
    router.refresh()
  }

  return (
    <main className="login-shell">
      <section className="card login-card">
        <p className="pill">World Cup 2026 Sweepstake</p>
        <h1 className="title">Sign in to draft your nations</h1>
        <p className="muted">5 players. 9 snake rounds. Winner takes £125.</p>

        <form onSubmit={onSubmit} className="login-form">
          <label>
            Name
            <input
              className="field"
              autoComplete="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your player name"
            />
          </label>

          <label>
            PIN
            <input
              className="field"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Enter Sweepstake'}
          </button>
        </form>
      </section>
    </main>
  )
}
