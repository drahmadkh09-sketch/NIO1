export type TemplateInput = {
  name: string
  description: string
  colors: string[]
  typography: string[]
  spacing: string[]
  components: string[]
  layoutNotes: string
}

export type StyleAnalysis = {
  dominantColors: string[]
  accentColor: string
  typographyScale: string[]
  spacingScale: string[]
  componentPatterns: string[]
  mood: string
}

export type DesignRules = {
  tokens: {
    color: Record<string, string>
    typography: Record<string, string>
    spacing: Record<string, string>
    radius: Record<string, string>
    shadow: Record<string, string>
  }
  components: {
    name: string
    states: string[]
    notes: string
  }[]
  layoutRules: string[]
}

export type FigmaPayload = {
  fileName: string
  styles: {
    colors: { name: string; value: string }[]
    text: { name: string; value: string }[]
    effects: { name: string; value: string }[]
  }
  components: {
    name: string
    variants: string[]
    autoLayout: boolean
  }[]
}

export type GeneratedLayout = {
  name: string
  sections: string[]
  improvements: string[]
}

const fallbackColors = ['#020617', '#0f172a', '#06b6d4', '#3b82f6', '#a855f7']
const fallbackTypography = ['12', '14', '16', '18', '24']
const fallbackSpacing = ['4', '8', '12', '16', '24', '32']

export function parseTemplateText(raw: string): TemplateInput {
  const lines = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

  const colors = uniqueFromRegex(raw, /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || fallbackColors
  const typography = uniqueFromRegex(raw, /\b(?:\d{1,2}px|xs|sm|base|lg|xl|2xl|3xl)\b/g) || fallbackTypography
  const spacing = uniqueFromRegex(raw, /\b(?:\d{1,2}px|p-\d+|m-\d+|gap-\d+)\b/g) || fallbackSpacing

  const keywords = ['card', 'table', 'chart', 'navbar', 'sidebar', 'modal', 'button', 'badge', 'panel']
  const components = keywords.filter((k) => raw.toLowerCase().includes(k))

  return {
    name: firstHeading(lines) ?? 'Imported Template',
    description: lines.slice(0, 3).join(' ') || 'Imported template content',
    colors,
    typography,
    spacing,
    components: components.length ? components : ['card', 'panel', 'button', 'table'],
    layoutNotes: lines.slice(0, 20).join(' '),
  }
}

function uniqueFromRegex(raw: string, regex: RegExp): string[] {
  const matches = raw.match(regex) ?? []
  return [...new Set(matches)].slice(0, 16)
}

function firstHeading(lines: string[]): string | null {
  const h = lines.find((l) => l.startsWith('#'))
  if (!h) return null
  return h.replace(/^#+\s*/, '').trim() || null
}

export function analyzeStyle(template: TemplateInput): StyleAnalysis {
  const dominantColors = template.colors.slice(0, 5)
  const accentColor = dominantColors[2] ?? dominantColors[0] ?? '#06b6d4'

  return {
    dominantColors,
    accentColor,
    typographyScale: normalizeTypeScale(template.typography),
    spacingScale: normalizeSpaceScale(template.spacing),
    componentPatterns: template.components,
    mood: inferMood(template),
  }
}

function normalizeTypeScale(values: string[]): string[] {
  const mapped = values.map((v) => v.replace('px', ''))
  return [...new Set(mapped)].slice(0, 8)
}

function normalizeSpaceScale(values: string[]): string[] {
  const cleaned = values.map((v) => v.replace(/[^0-9]/g, '')).filter(Boolean)
  return [...new Set(cleaned)].slice(0, 8)
}

function inferMood(template: TemplateInput): string {
  const body = `${template.description} ${template.layoutNotes}`.toLowerCase()
  if (body.includes('cyber') || body.includes('neon')) return 'Cyberpunk Futuristic'
  if (body.includes('minimal')) return 'Minimal Clean'
  if (body.includes('enterprise')) return 'Enterprise Professional'
  return 'Modern Data UI'
}

export function extractDesignRules(a: StyleAnalysis): DesignRules {
  const color: Record<string, string> = {
    bg: a.dominantColors[0] ?? '#020617',
    surface: a.dominantColors[1] ?? '#0f172a',
    primary: a.accentColor,
    secondary: a.dominantColors[3] ?? '#3b82f6',
    accent: a.dominantColors[4] ?? '#a855f7',
    text: '#dbeafe',
  }

  const typography: Record<string, string> = {
    title: a.typographyScale[a.typographyScale.length - 1] ?? '24',
    h2: a.typographyScale[a.typographyScale.length - 2] ?? '18',
    body: a.typographyScale[1] ?? '14',
    mono: '12',
  }

  const spacing: Record<string, string> = {
    xs: a.spacingScale[0] ?? '4',
    sm: a.spacingScale[1] ?? '8',
    md: a.spacingScale[2] ?? '12',
    lg: a.spacingScale[3] ?? '16',
    xl: a.spacingScale[4] ?? '24',
  }

  const components = a.componentPatterns.map((name) => ({
    name,
    states: ['default', 'hover', 'active', 'disabled'],
    notes: `Use ${a.accentColor} glow with subtle blur and strong hierarchy`,
  }))

  return {
    tokens: {
      color,
      typography,
      spacing,
      radius: { sm: '8', md: '12', lg: '18' },
      shadow: {
        glow: `0 0 20px ${a.accentColor}66`,
        panel: '0 16px 40px #00000066',
      },
    },
    components,
    layoutRules: [
      'Use 12-column responsive grid with fixed sidebar',
      'Top KPI row + primary chart canvas + secondary analytics panels',
      'Keep visual depth with layered cards and neon border accents',
      'Prioritize contrast, reduce clutter, and preserve interaction feedback',
    ],
  }
}

export function buildFigmaPayload(rules: DesignRules, templateName: string): FigmaPayload {
  return {
    fileName: `${templateName.replace(/\s+/g, '-')}-design-system`,
    styles: {
      colors: Object.entries(rules.tokens.color).map(([name, value]) => ({ name, value })),
      text: Object.entries(rules.tokens.typography).map(([name, value]) => ({ name, value: `${value}px` })),
      effects: Object.entries(rules.tokens.shadow).map(([name, value]) => ({ name, value })),
    },
    components: rules.components.map((c) => ({
      name: c.name,
      variants: c.states,
      autoLayout: true,
    })),
  }
}

export function generateLayouts(_rules: DesignRules): GeneratedLayout[] {
  return [
    {
      name: 'Operations Command View',
      sections: ['Sidebar', 'Top KPIs', 'Main 3D Activity Zone', 'Alerts Rail', 'Event Timeline'],
      improvements: ['Cleaner hierarchy', 'Faster scanability', 'Better spacing rhythm'],
    },
    {
      name: 'Analytics Deep-Dive View',
      sections: ['Filter Bar', 'Trend Grid', 'Agent Performance Matrix', 'Task Funnel', 'Export Panel'],
      improvements: ['Comparative insights', 'Actionable metric clusters', 'Presentation-ready cards'],
    },
    {
      name: 'Executive Snapshot View',
      sections: ['Headline KPIs', 'Health Score Ring', 'Risk Heatmap', 'Weekly Summary', 'Recommendations'],
      improvements: ['Decision-first framing', 'Low cognitive load', 'High-contrast summaries'],
    },
  ]
}
