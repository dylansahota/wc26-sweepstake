import * as dotenv from 'dotenv'
import { syncMatchesFromFootballData } from '../lib/football-data'

dotenv.config({ path: '.env.local' })

async function seed() {
  const count = await syncMatchesFromFootballData()
  console.log(`Fixtures seeded successfully: ${count} matches`)
}

seed().catch((err) => {
  console.error('Seeding fixtures failed:', err)
  process.exit(1)
})
