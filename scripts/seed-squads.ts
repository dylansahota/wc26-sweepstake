import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { getFifaSquadSlugCandidates } from '../lib/fifa-squad-slugs'

dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  throw new Error('Missing Supabase env vars in .env.local')
}

const supabase = createClient(url, serviceRole)

type SquadPosition = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

interface SquadMemberRow {
  team_id: string
  name: string
  position: SquadPosition | 'MANAGER'
  squad_role: 'player' | 'manager'
  shirt_number: number | null
  source_url: string
}

const POSITION_HEADINGS: ReadonlyArray<{ heading: string; position: SquadPosition }> = [
  { heading: 'Goalkeeper', position: 'GOALKEEPER' },
  { heading: 'Defender', position: 'DEFENDER' },
  { heading: 'Midfielder', position: 'MIDFIELDER' },
  { heading: 'Forward', position: 'FORWARD' },
] as const

function isUppercaseLabel(line: string): boolean {
  return ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'MANAGER'].includes(line)
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function looksLikePlayerName(line: string): boolean {
  if (!line) return false
  if (line.length < 3) return false
  if (/^(News|Fixtures|Squad|Manager|Goalkeeper|Defender|Midfielder|Forward)$/.test(line)) return false
  if (isUppercaseLabel(line)) return false
  if (/^(We Care About Your Privacy|I Accept|Reject All|Show Purposes|Skip to main content)$/.test(line)) return false
  return /[A-Za-z]/.test(line)
}

function dedupeMembers(rows: SquadMemberRow[]): SquadMemberRow[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.team_id}:${row.name}:${row.squad_role}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseSquadText(text: string, teamId: string, sourceUrl: string): SquadMemberRow[] {
  const lines = text
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const rows: SquadMemberRow[] = []
  let currentPosition: SquadPosition | null = null
  let currentRole: 'player' | 'manager' = 'player'

  for (const line of lines) {
    const positionHeading = POSITION_HEADINGS.find((entry) => entry.heading === line)
    if (positionHeading) {
      currentPosition = positionHeading.position
      currentRole = 'player'
      continue
    }

    if (line === 'Manager') {
      currentPosition = null
      currentRole = 'manager'
      continue
    }

    if (!looksLikePlayerName(line)) continue

    if (currentRole === 'manager') {
      rows.push({
        team_id: teamId,
        name: line,
        position: 'MANAGER',
        squad_role: 'manager',
        shirt_number: null,
        source_url: sourceUrl,
      })
      currentRole = 'player'
      continue
    }

    if (!currentPosition) continue

    rows.push({
      team_id: teamId,
      name: line,
      position: currentPosition,
      squad_role: 'player',
      shirt_number: null,
      source_url: sourceUrl,
    })
  }

  return dedupeMembers(rows)
}

async function getValidSquadPage(browserPage: Awaited<ReturnType<ReturnType<typeof chromium.launch>['newPage']>>, teamName: string) {
  for (const slug of getFifaSquadSlugCandidates(teamName)) {
    const sourceUrl = `https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams/${slug}/squad`
    await browserPage.goto(sourceUrl, { waitUntil: 'networkidle' })

    const text = await browserPage.locator('body').innerText()
    if (text.includes("Come on referee, you weren't supposed to see this!")) {
      continue
    }

    if (text.includes('Squad') && POSITION_HEADINGS.some((entry) => text.includes(entry.heading))) {
      return { sourceUrl, text }
    }
  }

  return null
}

async function seed() {
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name').order('name')
  if (teamsError) throw new Error(teamsError.message)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    for (const team of teams ?? []) {
      const teamId = team.id as string
      const teamName = team.name as string
      const validPage = await getValidSquadPage(page, teamName)

      if (!validPage) {
        throw new Error(`Could not find a valid FIFA squad page for ${teamName}`)
      }

      const members = parseSquadText(validPage.text, teamId, validPage.sourceUrl)
      if (members.length === 0) {
        throw new Error(`No squad members parsed for ${teamName}`)
      }

      const { error: deleteError } = await supabase.from('team_squad_members').delete().eq('team_id', teamId)
      if (deleteError) throw new Error(deleteError.message)

      const { error: insertError } = await supabase.from('team_squad_members').insert(members)
      if (insertError) throw new Error(insertError.message)

      console.log(`Seeded ${members.length} squad entries for ${teamName}`)
    }
  } finally {
    await page.close()
    await browser.close()
  }

  console.log('Official FIFA squads seeded successfully')
}

seed().catch((err) => {
  console.error('Seeding squads failed:', err)
  process.exit(1)
})
