import { useEffect, useId, useRef, useState } from 'react'
import { Button, EnterKbd, Eyebrow, Kbd, useEnterKey, useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import type { BlockProps } from '../types'
import { Answered, cardLabelCls } from './_parts/Answered'
import diagrams from '../../../../../fixtures/diagrams.json'

export const type = 'data_import'

// The pack's test clubs (club ids in demo/shots.csv).
const CLUBS: [string, string][] = [
  ['own_7i', 'My own 7-iron'],
  ['takomo_201-mkii_kbs-tour-regular_std', 'Takomo 201 MKII test club'],
  ['takomo_101-mkii_kbs-tour-lite-regular_std', 'Takomo 101 MKII test club'],
]
const LINE_STEPS = diagrams.ball_line_test.steps
const UNAVAILABLE = "Couldn't parse that CSV. Ensure it's an unedited TrackMan export, or skip for now."

// Local minimal types: these demo routes are not in the generated client yet.
interface Sample { sample_id: string; kind?: string; label?: string }
interface DemoGolfer { golfer_id: string; sample_imports?: Sample[] }

// C4c phone-mock illustrations (dark 120px panels), copied from V3-C4c-TrackMan.
function StepArt({ n }: { n: 1 | 2 | 3 }) {
  if (n === 3) {
    return (
      <svg viewBox="0 0 180 110" className="h-[100px]" aria-hidden="true">
        <rect x="10" y="38" width="160" height="34" rx="17" fill="#F8F8F8" />
        <text x="26" y="60" fill="#555555" fontFamily="Barlow" fontSize="13">trackman.com/report/…</text>
        <path d="M120 86 l8 -14 l3 9 l9 1 z" fill="#FF6E01" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 110" className="h-[104px]" aria-hidden="true">
      <rect x="34" y="4" width="52" height="102" rx="9" fill="#1A1A1A" stroke="#3D3D3D" />
      {n === 1 ? (
        <>
          <rect x="42" y="18" width="36" height="8" rx="2" fill="#3D3D3D" />
          <rect x="42" y="32" width="36" height="14" rx="3" fill="#262626" />
          <rect x="42" y="50" width="36" height="14" rx="3" fill="#FF6E01" />
          <rect x="42" y="68" width="36" height="14" rx="3" fill="#262626" />
        </>
      ) : (
        <>
          <rect x="42" y="18" width="36" height="40" rx="3" fill="#262626" />
          <path d="M50 52 L58 40 L64 46 L72 34" fill="none" stroke="#5F5F5F" strokeWidth="1.5" />
          <rect x="44" y="70" width="32" height="14" rx="7" fill="#FF6E01" />
          <path d="M56 77 L60 73 L64 77 M60 73 V82" stroke="#0B0B0B" strokeWidth="1.5" fill="none" />
        </>
      )}
    </svg>
  )
}

const TM_STEPS: [1 | 2 | 3, string][] = [
  [1, 'Open the TrackMan Golf app and pick your session'],
  [2, 'Tap Share and export the session (CSV)'],
  [3, 'Bring it in here. We pull every 7-iron shot'],
]

/** Focuses the first ball-line reading when the panel appears (stable, so it runs once per mount). */
const focusOnMount = (el: HTMLInputElement | null) => el?.focus({ preventScroll: true })

const boxCls =
  'h-12 rounded-10 border border-grey-c8 bg-white px-3 font-sans text-[16px] text-midnight outline-none focus-visible:border-midnight disabled:opacity-60'

/**
 * C4c guided import. Working actions: TrackMan CSV upload, persona sample imports ("Simulated"),
 * ball-line readings, skip. The share-link field is shown disabled (link importer cut, plan L6).
 * Keys: Enter opens the CSV upload, number keys run the sample imports. The ball-line panel focuses its first reading;
 * Enter in a filled reading moves to the next one, and Enter on an empty or the last one sends (at least 3).
 * Payloads unchanged: `{import_id}` or `{skipped: true}`.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'data_import'>) {
  const { sessionId, demo } = useSession()
  const [lineOpen, setLineOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [club, setClub] = useState<string>(block.club_hint ?? 'own_7i')
  const [readings, setReadings] = useState(['', '', '', '', ''])
  const [samples, setSamples] = useState<Sample[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const clubId = useId()
  const live = interactive && !answer
  const off = !live || busy || working

  useEffect(() => {
    if (!demo || !live) return
    fetch('/api/demo')
      .then((r) => (r.ok ? (r.json() as Promise<DemoGolfer[]>) : []))
      .then((list) => setSamples(list.find((g) => g.golfer_id === demo)?.sample_imports ?? []))
      .catch(() => {}) // route may not exist yet
  }, [demo, live])

  const has = (s: string) => block.sources.includes(s as (typeof block.sources)[number])
  const guided = has('trackman_link') || has('csv')
  // Keydown is a user gesture, so Enter may open the file picker. Samples run on 1-9 (persona sessions only).
  useEnterKey(() => fileRef.current?.click(), guided && !off)
  useNumberKeys(samples.length, (i) => void sendSample(samples[i]), !off)

  if (!live) return <Answered prompt={block.prompt} answer={answer} />

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

  const lineOnly = has('ball_line') && !guided
  const showLine = has('ball_line') && (lineOnly || lineOpen)
  const shots = has('screenshot') || has('round_stats_screenshot')
  const clubs = CLUBS.some(([v]) => v === club) ? CLUBS : [...CLUBS, [club, club] as [string, string]]

  return (
    <div className="flex flex-col gap-[18px]">
      <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
      <p className="m-0 text-[13px] text-grey-8f">We keep the numbers, not the file.</p>

      {guided && (
        <>
          <ol className="m-0 grid list-none grid-cols-3 gap-4 p-0">
            {TM_STEPS.map(([n, text]) => (
              <li key={n} className="flex flex-col gap-2.5">
                <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-12 bg-midnight">
                  <StepArt n={n} />
                </div>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-display text-[22px] font-extrabold text-orange-text tabular-nums">{n}</span>
                  <span className="text-[15px] leading-[1.4]">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          {has('trackman_link') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2.5">
                <label htmlFor={`${clubId}-link`} className="sr-only">TrackMan report link (coming soon)</label>
                <input
                  id={`${clubId}-link`}
                  type="url"
                  disabled
                  placeholder="TrackMan share link (coming soon)"
                  className="h-[58px] min-w-0 flex-1 cursor-not-allowed rounded-10 border-2 border-grey-c8 bg-grey-ed px-[18px] font-sans text-[18px] text-grey-6b placeholder:text-grey-8f"
                />
                <Button variant="outline" disabled className="min-h-[58px]">Coming soon</Button>
              </div>
              <span className="text-[14px] text-grey-55">Direct share links are coming soon. For now, drop in your exported CSV file.</span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2.5">
            <label htmlFor={clubId} className="flex flex-col gap-1.5 text-[14px] font-semibold">
              Hit with
              <select id={clubId} className={boxCls} value={club} disabled={off} onChange={(e) => setClub(e.target.value)}>
                {clubs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void run(() => csvPost(f, f.name, club))
              }}
            />
            <Button variant="primary" className="min-h-12 pr-3" disabled={off} aria-keyshortcuts="Enter" onClick={() => fileRef.current?.click()}>
              {working ? 'Crunching your shots…' : 'Upload TrackMan CSV'}
              <EnterKbd tone="primary" />
            </Button>
          </div>
        </>
      )}

      {samples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Eyebrow className="text-grey-55">Try a sample</Eyebrow>
          {samples.map((s, i) => (
            <Button key={s.sample_id} size="sm" variant="outline" disabled={off} aria-keyshortcuts={i < 9 ? String(i + 1) : undefined} onClick={() => void sendSample(s)}>
              {i < 9 && <Kbd className="h-[22px] min-w-[22px] text-[12px]">{i + 1}</Kbd>}
              {s.label ?? s.sample_id}
              <span className="rounded-4 bg-grey-ed px-1.5 py-0.5 font-sans text-[11px] font-semibold tracking-normal text-grey-44 normal-case">Simulated</span>
            </Button>
          ))}
        </div>
      )}

      {showLine && (
        <div className="flex flex-col gap-3 rounded-14 border border-grey-e4 bg-white p-4">
          <span className="text-[16px] font-semibold">Ball-line test</span>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {LINE_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[15px]">
                <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-midnight font-display text-[13px] font-bold text-washed-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <span className="text-[14px] text-grey-55">{diagrams.ball_line_test.caption}. Enter degrees (e.g. +2 for toe-up, -1 for flat). At least 3 shots.</span>
          <div className="flex flex-wrap items-center gap-2">
            {readings.map((v, i) => (
              <input
                key={i} ref={i === 0 ? focusOnMount : undefined}
                type="number" step="0.5" aria-label={`Reading ${i + 1}`} placeholder={i < 3 ? 'deg' : 'optional'}
                className={cn(boxCls, 'w-24 text-center font-display text-[20px] font-bold tabular-nums')} value={v} disabled={off}
                onChange={(e) => setReadings((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || off) return
                  const next = e.currentTarget.parentElement?.querySelectorAll('input')[i + 1]
                  if (v !== '' && next) next.focus()
                  else if (readings.filter((x) => x !== '').length >= 3) void sendLine()
                }}
              />
            ))}
            <Button variant="dark" className="ml-auto" disabled={off || readings.filter((x) => x !== '').length < 3} onClick={() => void sendLine()}>
              Send readings
            </Button>
          </div>
        </div>
      )}

      {msg && <p role="status" className="m-0 text-[15px] text-grey-44">{msg}</p>}

      {((has('ball_line') && !lineOnly) || shots || has('skip')) && (
      <div className="flex flex-wrap items-center gap-3 border-t border-grey-e4 pt-3.5">
        {has('ball_line') && !lineOnly && (
          <Button variant="outline" size="sm" disabled={off} aria-expanded={lineOpen} onClick={() => setLineOpen((o) => !o)}>
            {lineOpen ? 'Hide ball-line test' : 'Ball-line test instead'}
          </Button>
        )}
        {shots && (
          <span className="text-[14px] text-grey-55">
            Photo of the screen: <span className="font-semibold text-grey-6b">coming soon</span>
          </span>
        )}
        {has('skip') && (
          <Button variant="outline" className="ml-auto" disabled={off} onClick={() => respond({ skipped: true }, 'Skip for now')}>
            Skip for now
          </Button>
        )}
      </div>
      )}
    </div>
  )
}
