const SLUG_CANDIDATES: Record<string, string[]> = {
  Algeria: ['algeria'],
  Argentina: ['argentina'],
  Australia: ['australia'],
  Austria: ['austria'],
  Belgium: ['belgium'],
  'Bosnia and Herzegovina': ['bosnia-herzegovina', 'bosnia-and-herzegovina'],
  Brazil: ['brazil'],
  Canada: ['canada'],
  'Cape Verde': ['cabo-verde', 'cape-verde'],
  Colombia: ['colombia'],
  Croatia: ['croatia'],
  Curacao: ['curacao', 'curacao-squad'],
  'Czech Republic': ['czechia', 'czech-republic'],
  'DR Congo': ['congo-dr', 'dr-congo'],
  Ecuador: ['ecuador'],
  Egypt: ['egypt'],
  England: ['england'],
  France: ['france'],
  Germany: ['germany'],
  Ghana: ['ghana'],
  Haiti: ['haiti'],
  Iran: ['ir-iran', 'iran'],
  Iraq: ['iraq'],
  'Ivory Coast': ['cote-d-ivoire', 'cote-divoire', 'ivory-coast'],
  Japan: ['japan'],
  Jordan: ['jordan'],
  Mexico: ['mexico'],
  Morocco: ['morocco'],
  Netherlands: ['netherlands'],
  'New Zealand': ['new-zealand'],
  Norway: ['norway'],
  Panama: ['panama'],
  Paraguay: ['paraguay'],
  Portugal: ['portugal'],
  Qatar: ['qatar'],
  'Saudi Arabia': ['saudi-arabia'],
  Scotland: ['scotland'],
  Senegal: ['senegal'],
  'South Africa': ['south-africa'],
  'South Korea': ['korea-republic', 'south-korea'],
  Spain: ['spain'],
  Sweden: ['sweden'],
  Switzerland: ['switzerland'],
  Tunisia: ['tunisia'],
  Turkey: ['turkiye', 'turkey'],
  'United States': ['usa', 'united-states', 'united-states-of-america'],
  Uruguay: ['uruguay'],
  Uzbekistan: ['uzbekistan'],
}

function slugifyTeamName(teamName: string): string {
  return teamName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getFifaSquadSlugCandidates(teamName: string): string[] {
  const seen = new Set<string>()
  const candidates = [...(SLUG_CANDIDATES[teamName] ?? []), slugifyTeamName(teamName)]
  return candidates.filter((slug) => {
    if (seen.has(slug)) return false
    seen.add(slug)
    return true
  })
}
