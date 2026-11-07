import { useEffect, useState } from 'react'
import diagrams from '../../../../../fixtures/diagrams.json'
import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'
import { answeredCls, btnCls, chipCls, eyebrowCls, inputCls, labelCls, panelCls, promptCls } from '../ui'
import type { BlockProps } from '../types'

export const type = 'data_import'

const SOON = ['trackman_link', 'screenshot', 'round_stats_screenshot']
const NAMES: Record<string, string> = {
  csv: 'TrackMan CSV', ball_line: 'Ball-line test', skip: 'Skip for now',
  trackman_link: 'TrackMan link', screenshot: 'Screenshot', round_stats_screenshot: 'Round stats screenshot',
}
// The pack's test clubs (club ids in demo/shots.csv).
const CLUBS: [string, string][] = [
  ['own_7i', 'My own 7-iron'],
  ['takomo_201-mkii_kbs-tour-regular_std', 'Takomo 201 MKII test club'],
  ['takomo_101-mkii_kbs-tour-lite-regular_std', 'Takomo 101 MKII test club'],
]
const UNAVAILABLE = 'Import is not available yet. You can skip for now.'

// Local minimal types: these demo routes are not in the generated client yet.
interface Sample { sample_id: string; kind?: string; label?: string }
interface DemoGolfer { golfer_id: string; sample_imports?: Sample[] }

export function Component({ block, interactive, answer, busy, respond }: BlockProps<'data_import'>) {
  const { sessionId, demo } = useSession()
  const [tab, setTab] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [club, setClub] = useState<string>(block.club_hint ?? 'own_7i')
  const [file, setFile] = useState<File | null>(null)
  const [readings, setReadings] = useState(['', '', '', '', ''])
  const [samples, setSamples] = useState<Sample[]>([])
  const off = !interactive || busy || working

  useEffect(() => {
    if (!demo || !interactive) return
    fetch('/api/demo')
      .then((r) => (r.ok ? (r.json() as Promise<DemoGolfer[]>) : []))
      .then((list) => setSamples(list.find((g) => g.golfer_id === demo)?.sample_imports ?? []))
      .catch(() => {}) // route may not exist yet
  }, [demo, interactive])

  const done = (r: Response, n?: string) =>
    r.json().then(async (j: { import_id?: string; status?: string; report?: { n_shots?: number } }) => {
      if (!j.import_id) throw new Error('no id')
      // The golfer chose the file and tapped Import: that is the confirm. Shots reach the fit only once confirmed.
      if (j.status === 'pending') {
        const c = await fetch(`/api/sessions/${sessionId}/imports/${j.import_id}/confirm`, { method: 'POST' })
        if (!c.ok) throw new Error(String(c.status))
      }
      const shots = j.report?.n_shots
      respond({ import_id: j.import_id }, n ?? (shots ? `Imported ${shots} shots` : 'Imported my shots'))
    })

  const run = async (go: () => Promise<Response>, text?: string) => {
    setWorking(true); setMsg(null)
    try {
      const r = await go()
      if (!r.ok) throw new Error(String(r.status))
      await done(r, text)
    } catch {
      setMsg(UNAVAILABLE)
    } finally {
      setWorking(false)
    }
  }

  const base = `/api/sessions/${sessionId}/imports`
  const csvPost = (f: Blob, name: string, c: string) => {
    const fd = new FormData()
    fd.append('file', f, name); fd.append('club', c)
    return fetch(`${base}/trackman-csv`, { method: 'POST', body: fd })
  }
  const sendLine = () => {
    const nums = readings.filter((x) => x !== '').map(Number)
    return run(() =>
      fetch(`${base}/ball-line`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readings_deg: nums, club: block.club_hint ?? undefined, append_to: block.append_to ?? undefined }),
      }), `Ball-line readings: ${nums.join(', ')}`)
  }
  const sendSample = (s: Sample) =>
    run(async () => {
      const g = await fetch(`/api/demo/${demo}/samples/${s.sample_id}`)
      if (!g.ok) return g
      if (s.kind === 'ball_line') {
        return fetch(`${base}/ball-line`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await g.text() })
      }
      return csvPost(await g.blob(), s.sample_id, block.club_hint ?? 'own_7i')
    })

  if (!interactive) {
    return (
      <div className="flex flex-col gap-1">
        <p className={promptCls}>{block.prompt}</p>
        {answer && <p className={answeredCls}>Answered: <strong>{answer.displayText}</strong></p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={promptCls}>{block.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {block.sources.map((s) =>
          s === 'skip' ? (
            <button key={s} type="button" className={`${chipCls(false)} border-dashed`} disabled={off} onClick={() => respond({ skipped: true }, 'Skip for now')}>{NAMES[s]}</button>
          ) : SOON.includes(s) ? (
            <button key={s} type="button" className={chipCls(false)} disabled title="Coming soon">{NAMES[s]} (coming soon)</button>
          ) : (
            <button key={s} type="button" className={chipCls(tab === s)} disabled={off} onClick={() => { setTab(s); setMsg(null) }}>{NAMES[s]}</button>
          ),
        )}
      </div>

      {tab === 'csv' && (
        <div className={panelCls}>
          <label className={labelCls}>Club
            <select className={inputCls} value={club} disabled={off} onChange={(e) => setClub(e.target.value)}>
              {(CLUBS.some(([v]) => v === club) ? CLUBS : [...CLUBS, [club, club]]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <input type="file" accept=".csv,text/csv" disabled={off} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <Button className={`self-start ${btnCls}`} disabled={off || !file} onClick={() => file && void run(() => csvPost(file, file.name, club))}>Import shots</Button>
        </div>
      )}

      {tab === 'ball_line' && (
        <div className={panelCls}>
          <ol className="list-decimal pl-5 text-sm text-ink-700">
            {diagrams.ball_line_test.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">{diagrams.ball_line_test.caption}. Enter degrees; at least 3 readings.</p>
          <div className="flex gap-2">
            {readings.map((v, i) => (
              <input key={i} type="number" step="0.5" aria-label={`Reading ${i + 1}`} placeholder={i < 3 ? 'deg' : 'optional'}
                className={`${inputCls} w-20 text-center`} value={v} disabled={off}
                onChange={(e) => setReadings((r) => r.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
          </div>
          <Button className={`self-start ${btnCls}`} disabled={off || readings.filter((x) => x !== '').length < 3} onClick={() => void sendLine()}>Send readings</Button>
        </div>
      )}

      {samples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className={eyebrowCls}>Sample data</span>
          {samples.map((s) => (
            <Button key={s.sample_id} size="sm" variant="outline" className="font-medium" disabled={off} onClick={() => void sendSample(s)}>
              {s.label ?? s.sample_id} (simulated)
            </Button>
          ))}
        </div>
      )}
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  )
}
