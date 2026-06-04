import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { getTierForTeam } from '../lib/domain'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  throw new Error('Missing Supabase env vars in .env.local')
}

const supabase = createClient(url, serviceRole)

const teams = [
  { name: 'Argentina', code: 'ARG' },
  { name: 'Algeria', code: 'ALG' },
  { name: 'Australia', code: 'AUS' },
  { name: 'Austria', code: 'AUT' },
  { name: 'Belgium', code: 'BEL' },
  { name: 'Bosnia and Herzegovina', code: 'BIH' },
  { name: 'Brazil', code: 'BRA' },
  { name: 'Canada', code: 'CAN' },
  { name: 'Cape Verde', code: 'CPV' },
  { name: 'Colombia', code: 'COL' },
  { name: 'Croatia', code: 'CRO' },
  { name: 'Curacao', code: 'CUW' },
  { name: 'Czech Republic', code: 'CZE' },
  { name: 'DR Congo', code: 'COD' },
  { name: 'Ecuador', code: 'ECU' },
  { name: 'Egypt', code: 'EGY' },
  { name: 'England', code: 'ENG' },
  { name: 'France', code: 'FRA' },
  { name: 'Spain', code: 'ESP' },
  { name: 'Germany', code: 'GER' },
  { name: 'Portugal', code: 'POR' },
  { name: 'Netherlands', code: 'NED' },
  { name: 'Ghana', code: 'GHA' },
  { name: 'Haiti', code: 'HTI' },
  { name: 'Iran', code: 'IRN' },
  { name: 'Iraq', code: 'IRQ' },
  { name: 'Ivory Coast', code: 'CIV' },
  { name: 'Japan', code: 'JPN' },
  { name: 'Jordan', code: 'JOR' },
  { name: 'Mexico', code: 'MEX' },
  { name: 'Morocco', code: 'MAR' },
  { name: 'New Zealand', code: 'NZL' },
  { name: 'Norway', code: 'NOR' },
  { name: 'Panama', code: 'PAN' },
  { name: 'Paraguay', code: 'PAR' },
  { name: 'Qatar', code: 'QAT' },
  { name: 'Saudi Arabia', code: 'KSA' },
  { name: 'Scotland', code: 'SCO' },
  { name: 'Senegal', code: 'SEN' },
  { name: 'South Africa', code: 'RSA' },
  { name: 'South Korea', code: 'KOR' },
  { name: 'Sweden', code: 'SWE' },
  { name: 'Switzerland', code: 'SUI' },
  { name: 'Tunisia', code: 'TUN' },
  { name: 'Turkey', code: 'TUR' },
  { name: 'United States', code: 'USA' },
  { name: 'Uruguay', code: 'URU' },
  { name: 'Uzbekistan', code: 'UZB' },
]

async function seed() {
  if (teams.length !== 48) {
    throw new Error(`Expected 48 teams, got ${teams.length}`)
  }

  const rows = teams.map((team) => ({
    name: team.name,
    code: team.code,
    tier: getTierForTeam(team.name),
  }))

  const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'name' })
  if (error) {
    throw new Error(error.message)
  }

  console.log('Teams seeded successfully')
}

seed().catch((err) => {
  console.error('Seeding teams failed:', err)
  process.exit(1)
})
