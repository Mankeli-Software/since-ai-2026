// L8: four personas only. Teasers must not give away the answer (plan 6.6). Never use golfers.csv `story`.
export interface Persona {
  id: string
  demoGolferId: string
  name: string
  age: number
  teaser: string
}

export const PERSONAS: Persona[] = [
  { id: 'mikko', demoGolferId: 'DEMO-01', name: 'Mikko', age: 46, teaser: 'Says his 7-iron goes 160 yards. Has TrackMan data.' },
  { id: 'hannu', demoGolferId: 'DEMO-09', name: 'Hannu', age: 60, teaser: 'The chart says standard lie. His ball-line test disagrees.' },
  { id: 'lars', demoGolferId: 'DEMO-04', name: 'Lars', age: 38, teaser: 'Low handicapper weighing pure feel against forgiveness.' },
  { id: 'anders', demoGolferId: 'DEMO-13', name: 'Anders', age: 44, teaser: 'Almost a stock set. Almost.' },
]

// Live engine; the server falls back to scripted when live is off (plan 4.7).
export const personaHref = (p: Persona) => `/studio.html?demo=${p.demoGolferId}&engine=live`
export const ownFittingHref = '/studio.html?engine=live&start=own'

/** v3 links keep the page's `?ff=` flags (always with v3) so the new flow stays on. */
function studioHrefV3(params: Record<string, string>) {
  const here = new URLSearchParams(location.search)
  const ff = new Set((here.get('ff') ?? '').split(',').filter(Boolean)).add('v3')
  const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  return `/studio.html?${[...q, `ff=${[...ff].map(encodeURIComponent).join(',')}`].join('&')}`
}

/** C1 "I'm ready. Let's start": your own fitting on the live engine (the server falls back to scripted
 * when live is off), unless the page says `?engine=scripted` (own.yaml, for dev and design review). */
export const ownFittingHrefV3 = () => {
  const engine = new URLSearchParams(location.search).get('engine')
  return studioHrefV3({ engine: engine === 'scripted' ? 'scripted' : 'live', start: 'own' })
}

/** "Try as" from the v3 welcome: live engine like personaHref (falls back to scripted), unless the page says otherwise. */
export const personaHrefV3 = (p: Persona) => {
  const engine = new URLSearchParams(location.search).get('engine')
  return studioHrefV3({ demo: p.demoGolferId, engine: engine === 'scripted' ? 'scripted' : 'live' })
}
