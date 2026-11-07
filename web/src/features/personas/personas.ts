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
  { id: 'lars', demoGolferId: 'DEMO-04', name: 'Lars', age: 38, teaser: 'Low handicapper who wants a forged head.' },
  { id: 'anders', demoGolferId: 'DEMO-13', name: 'Anders', age: 44, teaser: 'Almost a stock set. Almost.' },
]

// Live engine; the server falls back to scripted when live is off (plan 4.7).
export const personaHref = (p: Persona) => `/studio.html?demo=${p.demoGolferId}&engine=live`
export const ownFittingHref = '/studio.html?engine=live&start=own'
