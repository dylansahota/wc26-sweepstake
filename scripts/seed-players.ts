import * as dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  throw new Error('Missing Supabase env vars in .env.local')
}

const supabase = createClient(url, serviceRole)

const defaultPlayers = ['Abiola', 'Dylan', 'Liam', 'Tunde', 'Stephen']

function getPlayers() {
  const fromEnv = process.env.SWEEPSTAKE_PLAYERS
  if (!fromEnv) return defaultPlayers
  const players = fromEnv
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return players.length > 0 ? players : defaultPlayers
}

async function seed() {
  const players = getPlayers()
  if (players.length !== 5) {
    throw new Error(`Expected 5 players, received ${players.length}`)
  }

  const pinHash = await bcrypt.hash('1234', 10)
  const rows = players.map((name, idx) => ({
    name,
    colour: ['#60a5fa', '#4ade80', '#f7b538', '#f472b6', '#a78bfa'][idx],
    pin_hash: pinHash,
  }))

  const { error } = await supabase.from('players').upsert(rows, { onConflict: 'name' })
  if (error) {
    throw new Error(error.message)
  }

  console.log('Players seeded successfully')
}

seed().catch((err) => {
  console.error('Seeding players failed:', err)
  process.exit(1)
})
