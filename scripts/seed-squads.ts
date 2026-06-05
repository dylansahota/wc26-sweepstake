import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { chromium, type Page } from 'playwright'
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

const POSITION_LABELS: Record<SquadPosition, string> = {
  GOALKEEPER: 'GOALKEEPER',
  DEFENDER: 'DEFENDER',
  MIDFIELDER: 'MIDFIELDER',
  FORWARD: 'FORWARD',
}

const NOISE_LINES = new Set([
  'Skip to main content',
  'FIFA REWARDS',
  'FIFA+',
  'FIFA STORE',
  'FIFA COLLECT',
  '|',
  'English',
  'FIFA WORLD CUP 2026™',
  'MATCHES',
  'STANDINGS',
  'TEAMS & STATS',
  'NEWS',
  'FANTASY & GAMING',
  'MORE',
  'News',
  'Fixtures',
  'Squad',
])

function isUppercaseLabel(line: string): boolean {
  return ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'MANAGER'].includes(line)
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function looksLikeSquadName(line: string): boolean {
  if (!line) return false
  if (line.length < 3) return false
  if (/^(News|Fixtures|Squad|Manager|Goalkeeper|Defender|Midfielder|Forward)$/.test(line)) return false
  if (isUppercaseLabel(line)) return false
  if (/^(We Care About Your Privacy|I Accept|Reject All|Show Purposes|Skip to main content)$/.test(line)) return false
  return /[A-Za-z]/.test(line)
}

function normalizeSquadLines(text: string): string[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  const firstHeadingIndex = lines.findIndex((line) => POSITION_HEADINGS.some((entry) => entry.heading === line))
  if (firstHeadingIndex === -1) {
    return []
  }

  const relevantLines: string[] = []
  for (const line of lines.slice(firstHeadingIndex)) {
    if (line === 'We Care About Your Privacy') break
    if (NOISE_LINES.has(line)) continue
    relevantLines.push(line)
  }

  return relevantLines
}

function parseSectionMembers(lines: string[], label: string): string[] {
  const names: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!looksLikeSquadName(line)) continue

    if (lines[index + 1] !== label) continue

    names.push(line)
    index += 1
  }

  return names
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
  const lines = normalizeSquadLines(text)

  if (lines.length === 0) {
    return []
  }

  const rows: SquadMemberRow[] = []

  for (const { position } of POSITION_HEADINGS) {
    for (const name of parseSectionMembers(lines, POSITION_LABELS[position])) {
      rows.push({
        team_id: teamId,
        name,
        position,
        squad_role: 'player',
        shirt_number: null,
        source_url: sourceUrl,
      })
    }
  }

  const managerName = parseSectionMembers(lines, 'MANAGER').at(-1)
  if (managerName) {
    rows.push({
      team_id: teamId,
      name: managerName,
      position: 'MANAGER',
      squad_role: 'manager',
      shirt_number: null,
      source_url: sourceUrl,
    })
  }

  return dedupeMembers(rows)
}

async function getValidSquadPage(browserPage: Page, teamName: string) {
  for (const slug of getFifaSquadSlugCandidates(teamName)) {
    const sourceUrl = `https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams/${slug}/squad`
    await browserPage.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })

    try {
      await browserPage.waitForFunction(
        () => {
          const text = document.body.innerText
          return text.includes('Squad') && text.includes('Goalkeeper') && text.includes('Manager')
        },
        { timeout: 15000 }
      )
    } catch {
      continue
    }

    const text = await browserPage.locator('body').innerText()
    if (text.includes("Come on referee, you weren't supposed to see this!")) {
      continue
    }

    const parsedMembers = parseSquadText(text, 'validation', sourceUrl)
    const playerCount = parsedMembers.filter((member) => member.squad_role === 'player').length
    const managerCount = parsedMembers.filter((member) => member.squad_role === 'manager').length

    if (playerCount >= 23 && managerCount >= 1) {
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
  const failures: string[] = []

  try {
    for (const team of teams ?? []) {
      const teamId = team.id as string
      const teamName = team.name as string
      const validPage = await getValidSquadPage(page, teamName)

      if (!validPage) {
        failures.push(teamName)
        console.log(`Skipped ${teamName} (no parsable FIFA squad page found)`)
        continue
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

  if (failures.length > 0) {
    console.log(`Skipped ${failures.length} teams without parsable squads: ${failures.join(', ')}`)
  }

  console.log('Official FIFA squads seeded successfully')
}

seed().catch((err) => {
  console.error('Seeding squads failed:', err)
  process.exit(1)
})
