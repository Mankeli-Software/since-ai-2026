import { norm } from '../spoken'
import type { AnswerModule, VoiceCtx } from './types'

interface Sample { sample_id: string; kind?: string; label?: string }
interface DemoGolfer { golfer_id: string; sample_imports?: Sample[] }

/** The persona's sample import (L16), the same calls as the card's "Try a sample" button. */
async function importSample(said: string, club: string | null | undefined, ctx: VoiceCtx) {
  if (!ctx.demo) return null
  const list = (await (await fetch('/api/demo')).json()) as DemoGolfer[]
  const samples = list.find((g) => g.golfer_id === ctx.demo)?.sample_imports ?? []
  const n = norm(said)
  const s = samples.find((x) => x.label && n.includes(norm(x.label))) ?? samples[0]
  if (!s) return null
  const g = await fetch(`/api/demo/${ctx.demo}/samples/${s.sample_id}`)
  if (!g.ok) return null
  const base = `/api/sessions/${ctx.sessionId}/imports`
  let r: Response
  if (s.kind === 'ball_line') {
    r = await fetch(`${base}/ball-line`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await g.text() })
  } else {
    const fd = new FormData()
    fd.append('file', await g.blob(), s.sample_id)
    fd.append('club', club ?? 'own_7i')
    r = await fetch(`${base}/trackman-csv`, { method: 'POST', body: fd })
  }
  if (!r.ok) return null
  const j = (await r.json()) as { import_id?: string; status?: string; report?: { n_shots?: number } }
  if (!j.import_id) return null
  // Saying "use the sample" is the confirm, like tapping Import.
  if (j.status === 'pending') {
    const c = await fetch(`${base}/${j.import_id}/confirm`, { method: 'POST' })
    if (!c.ok) return null
  }
  const shots = j.report?.n_shots
  return { value: { import_id: j.import_id }, display: shots ? `Imported ${shots} shots` : 'Imported my shots' }
}

/** Files need a tap; "skip" and, for personas, "use the sample" work by voice. */
export default {
  type: 'data_import',
  ask: (b, ctx) =>
    `${b.prompt} ${ctx.demo ? 'Say "use the sample" to load the simulated shots, or "skip".' : 'Tap import to add your file, or say "skip".'}`,
  resolve(b, said, ctx) {
    const n = norm(said)
    if (/\b(skip|later|no|not now|without)\b/.test(n)) return { value: { skipped: true }, display: 'Skip for now' }
    if (/\b(sample|yes|import|load|use)\b/.test(n)) return importSample(said, b.club_hint, ctx)
    return null
  },
} satisfies AnswerModule<'data_import'>
