const TEAM_ALIASES: Record<string, string> = {
  USA: 'United States',
  'United States of America': 'United States',
  'IR Iran': 'Iran',
  'Iran PR': 'Iran',
  'Korea Republic': 'South Korea',
  'South Korea Republic': 'South Korea',
  'Congo DR': 'DR Congo',
  'DR Congo': 'DR Congo',
  "Cote d'Ivoire": 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  Czechia: 'Czech Republic',
    'Cabo Verde': 'Cape Verde',
    'Cape Verde Islands': 'Cape Verde',
  Curacao: 'Curacao',
  'Cura\u00e7ao': 'Curacao',
  Turkiye: 'Turkey',
  'T\u00fcrkiye': 'Turkey',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
}

export function normalizeTeamName(name?: string | null): string | null {
  if (!name) return null
  return TEAM_ALIASES[name] ?? name
}
