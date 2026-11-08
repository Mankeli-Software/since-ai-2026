import { useEffect, useId, useState, type ReactNode } from 'react'
import { Button, EnterKbd, useEnterKey } from '@/components/studio'
import type { FittingState } from '@/api/client'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'
import type { BlockProps } from '../types'
import { Answered, ReadOnly, cardLabelCls, isReadOnly } from './_parts/Answered'
import { SampleDialog, type SampleOption } from './_parts/SampleDialog'
import diagrams from '../../../../../fixtures/diagrams.json'

export const type = 'data_import'

// The pack's test clubs (club ids in demo/shots.csv): neutral names for the own-fitting sample list.
const CLUBS: Record<string, string> = {
  own_7i: '7-iron session',
  'takomo_201-mkii_kbs-tour-regular_std': 'Takomo 201 MKII test-club session',
  'takomo_101-mkii_kbs-tour-lite-regular_std': 'Takomo 101 MKII test-club session',
}
const LINE_STEPS = diagrams.ball_line_test.steps
const UNAVAILABLE = "Couldn't parse that CSV. Ensure it's an unedited TrackMan export, or skip for now."
const LINE_FAILED = "Couldn't use those readings. Each one needs to be between -15° and +15°."

// Local minimal types: these demo routes are not in the generated client yet.
interface Sample { sample_id: string; kind?: string; club?: string | null; label?: string }
interface DemoGolfer { golfer_id: string; sample_imports?: Sample[] }
/** A sample with the demo golfer whose file it is, and the label the dialog shows. */
interface Pick { golfer: string; s: Sample; label: string }

// #216 comment 1: simulated photo reads of the ball-line test. Each fills the five boxes; all inside the G15 window
// (readings within ±9°). No photo is taken or analysed.
const PHOTO_READS: (SampleOption & { readings: number[] })[] = [
  { id: 'toe', label: 'Toe-up lean', sub: 'Marks lean a little toward the toe', readings: [2, 1.5, 2.5, 2, 1] },
  { id: 'level', label: 'About level', sub: 'Marks close to straight up', readings: [0.5, -0.5, 0, 0.5, 0] },
  { id: 'heel', label: 'Heel-down lean', sub: 'Marks lean a little toward the heel', readings: [-1.5, -2, -1, -2, -1.5] },
]

/**
 * The samples the dialog lists. Persona sessions: that golfer's own sample imports, as labelled. Own fittings: the
 * TrackMan sessions of every demo golfer for the card's club (all of them when none match), plus ball-line sets on a
 * card that takes the ball-line test, numbered under neutral names (never a persona's name).
 */
function samplesFor(list: DemoGolfer[], demo: string | null, club: string, ballLine: boolean): Pick[] {
  if (demo) {
    const g = list.find((x) => x.golfer_id === demo)
    return (g?.sample_imports ?? []).map((s) => ({ golfer: demo, s, label: s.label ?? s.sample_id }))
  }
  const all = list.flatMap((g) => (g.sample_imports ?? []).map((s) => ({ golfer: g.golfer_id, s })))
  const seen = new Set<string>()
  const unique = all.filter(({ golfer, s }) => !seen.has(`${golfer}/${s.sample_id}`) && !!seen.add(`${golfer}/${s.sample_id}`))
  const tm = unique.filter(({ s }) => s.kind === 'trackman_csv')
  const forClub = tm.filter(({ s }) => (s.club ?? 'own_7i') === club)
  const line = ballLine ? unique.filter(({ s }) => s.kind === 'ball_line') : []
  const n: Record<string, number> = {}
  const name = (s: Sample) => (s.kind === 'ball_line' ? 'Ball-line readings' : CLUBS[s.club ?? 'own_7i'] ?? 'TrackMan session')
  return [...(forClub.length ? forClub : tm), ...line].map(({ golfer, s }) => {
    const base = name(s)
    n[base] = (n[base] ?? 0) + 1
    return { golfer, s, label: `${base} ${n[base]}` }
  })
}
interface ImportResult { import_id?: string; status?: string; report?: { n_shots?: number }; state?: FittingState | null }

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

// Drawn tilt = reading x 4, so a 2° lean is visible. The label carries the real number.
const TILT_SCALE = 4
const fmtDeg = (d: number) => {
  const r = Math.round(d * 10) / 10
  return `${r > 0 ? '+' : ''}${r}°`
}

/** Iron face from the front (heel left, toe right). The ball's mark leans `deg` toward the toe; null = no reading yet. */
function TiltFace({ deg, className }: { deg: number | null; className?: string }) {
  const a = deg === null ? 0 : Math.max(-36, Math.min(36, deg * TILT_SCALE))
  const r = 26
  const ex = 98 + r * Math.sin((a * Math.PI) / 180)
  const ey = 66 - r * Math.cos((a * Math.PI) / 180)
  return (
    <svg viewBox="0 0 180 110" className={className} aria-hidden="true">
      <path d="M44 58 L32 6 H42 L56 45" fill="#1A1A1A" stroke="#3D3D3D" />
      <path d="M40 90 H146 Q158 90 157 76 L152 40 Q150 30 140 31 L58 44 Q46 46 44 58 Z" fill="#262626" stroke="#3D3D3D" />
      {[52, 58, 64, 70, 76, 82].map((y) => (
        <line key={y} x1="54" y1={y} x2="148" y2={y} stroke="#333333" />
      ))}
      <line x1="98" y1="40" x2="98" y2="90" stroke="#8F8F8F" strokeDasharray="3 3" />
      {a !== 0 && (
        <path d={`M98 ${66 - r} A${r} ${r} 0 0 ${a > 0 ? 1 : 0} ${ex} ${ey}`} fill="none" stroke="#FF6E01" strokeWidth="1.5" />
      )}
      <line x1="98" y1="44" x2="98" y2="88" stroke={deg === null ? '#5F5F5F' : '#FF6E01'} strokeWidth="4" strokeLinecap="round" transform={`rotate(${a} 98 66)`} />
      {deg !== null && (
        <text x="116" y="24" fill="#FF8A33" fontFamily="Barlow Condensed" fontWeight="700" fontSize="18">{fmtDeg(deg)}</text>
      )}
      <text x="40" y="105" fill="#8F8F8F" fontFamily="Barlow Condensed" fontWeight="600" fontSize="11" letterSpacing="1.5">HEEL</text>
      <text x="156" y="105" textAnchor="end" fill="#8F8F8F" fontFamily="Barlow Condensed" fontWeight="600" fontSize="11" letterSpacing="1.5">TOE</text>
    </svg>
  )
}

const DIMPLES: [number, number][] = [[60, 46], [94, 48], [56, 70], [98, 72], [64, 88], [90, 88]]

/** The ball-line test in three dark panels, like the TrackMan steps: mark the ball, hit off a mat, read the tilt. */
function LineArt({ n }: { n: 1 | 2 | 3 }) {
  if (n === 3) return <TiltFace deg={2} className="h-[104px]" />
  if (n === 1) {
    return (
      <svg viewBox="0 0 180 110" className="h-[104px]" aria-hidden="true">
        <circle cx="76" cy="64" r="34" fill="#F8F8F8" />
        {DIMPLES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="#E4E4E4" />
        ))}
        <line x1="76" y1="32" x2="76" y2="96" stroke="#FF6E01" strokeWidth="3" strokeLinecap="round" />
        <g transform="translate(76 46) rotate(35)">
          <rect x="-7" y="-50" width="14" height="38" rx="3" fill="#5F5F5F" />
          <path d="M-7 -12 H7 L2.5 -2 H-2.5 Z" fill="#8F8F8F" />
          <rect x="-2" y="-3" width="4" height="4" fill="#FF6E01" />
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 180 110" className="h-[104px]" aria-hidden="true">
      <path d="M18 70 Q 42 92 70 88" fill="none" stroke="#5F5F5F" strokeWidth="1.5" strokeDasharray="4 5" />
      <line x1="44" y1="6" x2="80" y2="72" stroke="#8F8F8F" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 68 L96 73 L98 90 L72 90 Z" fill="#3D3D3D" />
      <circle cx="118" cy="80" r="10" fill="#F8F8F8" />
      <line x1="118" y1="71" x2="118" y2="89" stroke="#FF6E01" strokeWidth="2.5" />
      <rect x="12" y="90" width="156" height="10" rx="3" fill="#2A2A2A" />
    </svg>
  )
}

/** Three illustrated steps on dark 120px panels (C4c). Phones (M-04c): a numbered list, no pictures. */
function Steps({ items }: { items: [ReactNode, string][] }) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-4 p-0 max-md:grid-cols-1 max-md:gap-3">
      {items.map(([art, text], i) => (
        <li key={text} className="flex flex-col gap-2.5">
          <div className="flex h-[120px] items-center justify-center overflow-hidden rounded-12 bg-midnight max-md:hidden">
            {art}
          </div>
          <span className="flex items-baseline gap-2.5">
            <span className="font-display text-[22px] font-extrabold text-orange-text tabular-nums">{i + 1}</span>
            <span className="text-[15px] leading-[1.4]">{text}</span>
          </span>
        </li>
      ))}
    </ol>
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
// Number boxes without the spinner arrows, which ate half of each reading box.
const noSpinCls = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/**
 * C4c guided import. Working actions: sample imports ("Simulated", in a dialog), ball-line readings (typed or from a
 * simulated photo read), skip. The share-link field is shown disabled (link importer cut, plan L6).
 * #216: "Upload TrackMan CSV" opens the sample dialog; no file from the golfer's computer is read or uploaded.
 * Keys: Enter opens the dialog, number keys pick inside it. The ball-line panel focuses its first reading;
 * Enter in a filled reading moves to the next one, and Enter on an empty or the last one sends (at least 3).
 * Payloads unchanged: `{import_id}` or `{skipped: true}`.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'data_import'>) {
  const { sessionId, demo, mergeState } = useSession()
  const [lineOpen, setLineOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [readings, setReadings] = useState(['', '', '', '', ''])
  // The readings a simulated photo read filled in; null when none was used.
  const [photo, setPhoto] = useState<string[] | null>(null)
  const [golfers, setGolfers] = useState<DemoGolfer[] | null>(null)
  const [dialog, setDialog] = useState<'samples' | 'photo' | null>(null)
  const uid = useId()
  const live = interactive && !answer
  const off = !live || busy || working

  useEffect(() => {
    if (!live) return
    fetch('/api/demo')
      .then((r) => (r.ok ? (r.json() as Promise<DemoGolfer[]>) : []))
      .then(setGolfers)
      .catch(() => setGolfers([])) // route may not exist yet
  }, [live])

  const has = (s: string) => block.sources.includes(s as (typeof block.sources)[number])
  const guided = has('trackman_link') || has('csv')
  const samples = golfers ? samplesFor(golfers, demo, block.club_hint ?? 'own_7i', has('ball_line')) : []
  useEnterKey(() => setDialog('samples'), guided && !off && dialog === null)

  if (isReadOnly(interactive, answer)) {
    return (
      <ReadOnly answer={answer!}>
        <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
      </ReadOnly>
    )
  }
  if (!live) return <Answered prompt={block.prompt} answer={answer} />

  const done = (r: Response, n?: string, suffix = '') =>
    r.json().then(async (j: ImportResult) => {
      if (!j.import_id) throw new Error('no id')
      if (j.state) mergeState(j.state)
      // The golfer chose the file and tapped Import: that is the confirm. Shots reach the fit only once confirmed.
      if (j.status === 'pending') {
        const c = await fetch(`/api/sessions/${sessionId}/imports/${j.import_id}/confirm`, { method: 'POST' })
        if (!c.ok) throw new Error(String(c.status))
        // The confirmed state (new shots, confidence) shows now, also for the header's local Add data block, which
        // runs no turn (store/session.ts LOCAL_UI).
        const confirmed = (await c.json()) as ImportResult
        if (confirmed.state) mergeState(confirmed.state)
      }
      const shots = j.report?.n_shots
      respond({ import_id: j.import_id }, (n ?? (shots ? `Imported ${shots} shots` : 'Imported my shots')) + suffix)
    })

  const run = async (go: () => Promise<Response>, text?: string, fail = UNAVAILABLE, suffix = '') => {
    setWorking(true); setMsg(null)
    try {
      const r = await go()
      if (!r.ok) throw new Error(String(r.status))
      await done(r, text, suffix)
    } catch {
      setMsg(fail)
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
  // The readings came from a simulated photo read and the golfer has not changed them.
  const fromPhoto = photo !== null && readings.every((x, i) => x === photo[i])
  const sendLine = () => {
    const nums = readings.filter((x) => x !== '').map(Number)
    return run(() =>
      fetch(`${base}/ball-line`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readings_deg: nums, club: block.club_hint ?? undefined, append_to: block.append_to ?? undefined }),
      }), `Ball-line readings: ${nums.join(', ')}${fromPhoto ? ' (simulated photo)' : ''}`, LINE_FAILED)
  }
  // A sample goes through the same import path as a real file: fetch it, post it, confirm it.
  const sendSample = ({ golfer, s }: Pick) =>
    run(async () => {
      const g = await fetch(`/api/demo/${golfer}/samples/${s.sample_id}`)
      if (!g.ok) return g
      if (s.kind === 'ball_line') {
        return fetch(`${base}/ball-line`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await g.text() })
      }
      return csvPost(await g.blob(), `${s.sample_id}.csv`, s.club ?? block.club_hint ?? 'own_7i')
    }, undefined, UNAVAILABLE, ' (simulated sample)')
  const pickSample = (i: number) => {
    const p = samples[i]
    setDialog(null)
    if (p) void sendSample(p)
  }
  const pickPhoto = (i: number) => {
    const p = PHOTO_READS[i]
    setDialog(null)
    if (!p) return
    const filled = p.readings.map(String)
    setReadings(filled)
    setPhoto(filled)
  }

  // The ball-line offer: the test is explained up front, the reading boxes open on "Enter my readings".
  const lineOnly = has('ball_line') && !guided
  const showLine = has('ball_line') && lineOpen
  const shots = has('screenshot') || has('round_stats_screenshot')
  const filled = readings.filter((x) => x !== '')
  const avg = filled.length ? filled.reduce((s, x) => s + Number(x), 0) / filled.length : null
  const lean =
    avg === null
      ? 'Your lean shows here as you type.'
      : Math.abs(avg) < 0.05
        ? 'Average 0°: straight up.'
        : `Average ${fmtDeg(avg)}: leans toward the ${avg > 0 ? 'toe' : 'heel'}.`

  return (
    <div className="flex flex-col gap-[18px]">
      <p className={cn('m-0', cardLabelCls)}>{block.prompt}</p>
      {lineOnly ? (
        <p className="m-0 text-[15px] text-grey-55">Lie angle is how the club sits at impact: level, toe up or toe down.</p>
      ) : (
        <p className="m-0 text-[13px] text-grey-8f">We keep the numbers, not the file.</p>
      )}

      {lineOnly && <Steps items={LINE_STEPS.map((t, i) => [<LineArt n={(i + 1) as 1 | 2 | 3} />, t])} />}

      {guided && (
        <>
          <Steps items={TM_STEPS.map(([n, t]) => [<StepArt n={n} />, t])} />

          {has('trackman_link') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2.5">
                <label htmlFor={`${uid}-link`} className="sr-only">TrackMan report link (coming soon)</label>
                <input
                  id={`${uid}-link`}
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

          <div className="flex flex-wrap items-center gap-2.5 max-md:flex-col max-md:items-stretch">
            <Button variant="primary" className="min-h-12 pr-3 max-md:min-h-[52px]" disabled={off} aria-keyshortcuts="Enter" aria-haspopup="dialog" onClick={() => setDialog('samples')}>
              {working ? 'Crunching your shots…' : 'Upload TrackMan CSV'}
              <EnterKbd tone="primary" />
            </Button>
            <span className="text-[14px] text-grey-55">Opens a few simulated sessions to try.</span>
          </div>
        </>
      )}

      {showLine && (
        <div className="flex gap-5 rounded-14 border border-grey-e4 bg-white p-4 max-md:flex-col">
          <div className="flex w-[220px] flex-none flex-col gap-2 max-md:w-full">
            <div className="flex h-[140px] items-center justify-center rounded-12 bg-midnight">
              <TiltFace deg={avg} className="h-[128px]" />
            </div>
            <span aria-live="polite" className="text-[14px] text-grey-55">{lean}</span>
            <span className="text-[12px] text-grey-8f">Tilt drawn larger so it shows.</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-[16px] font-semibold">Your ball-line readings</span>
              <Button size="sm" variant="outline" className="pl-4" disabled={off} aria-haspopup="dialog" onClick={() => setDialog('photo')}>
                <CameraIcon />
                Read it from a photo
              </Button>
            </div>
            {!lineOnly && (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {LINE_STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[15px]">
                    <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-midnight font-display text-[13px] font-bold text-washed-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            )}
            <span className="text-[14px] text-grey-55">
              One number per shot, in degrees. Mark leans toward the toe: plus (+2). Toward the heel: minus (−1). Straight: 0.
            </span>
            <div data-readings className="flex flex-wrap gap-2">
              {readings.map((v, i) => (
                <label key={i} className="flex flex-col gap-1 text-[13px] font-semibold text-grey-55">
                  Shot {i + 1}
                  <input
                    ref={i === 0 ? focusOnMount : undefined}
                    type="number" inputMode="decimal" step="0.5" min="-15" max="15" placeholder={i < 3 ? '°' : 'opt.'}
                    className={cn(boxCls, noSpinCls, 'w-[76px] px-1 text-center font-display text-[20px] font-bold tabular-nums')} value={v} disabled={off}
                    onChange={(e) => setReadings((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || off) return
                      const next = e.currentTarget.closest('[data-readings]')?.querySelectorAll('input')[i + 1]
                      if (v !== '' && next) next.focus()
                      else if (filled.length >= 3) void sendLine()
                    }}
                  />
                </label>
              ))}
            </div>
            {photo !== null && (
              <span role="status" className="inline-flex items-center gap-2 text-[14px] text-grey-55">
                <span className="rounded-4 bg-grey-ed px-1.5 py-0.5 text-[11px] font-semibold text-grey-44">Simulated</span>
                {fromPhoto ? 'Simulated photo read. Edit any number.' : 'Started from a simulated photo read, then edited.'}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14px] text-grey-55">At least 3 shots, up to 5.</span>
              <Button variant="dark" className="ml-auto" disabled={off || filled.length < 3} onClick={() => void sendLine()}>
                Send readings
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && <p role="status" className="m-0 text-[15px] text-grey-44">{msg}</p>}

      {(has('ball_line') || shots || has('skip')) && (
      <div className="flex flex-wrap items-center gap-3 border-t border-grey-e4 pt-3.5">
        {lineOnly && samples.length > 0 && (
          <Button variant="outline" size="sm" disabled={off} aria-haspopup="dialog" onClick={() => setDialog('samples')}>
            Try a sample
          </Button>
        )}
        {has('ball_line') && (
          <Button
            variant={lineOnly && !lineOpen ? 'dark' : 'outline'}
            size={lineOnly ? 'md' : 'sm'}
            disabled={off}
            aria-expanded={lineOpen}
            onClick={() => setLineOpen((o) => !o)}
          >
            {lineOpen ? 'Hide readings' : lineOnly ? "I've done the test" : 'Ball-line test instead'}
          </Button>
        )}
        {shots && (
          <span className="text-[14px] text-grey-55">
            Photo of the screen: <span className="font-semibold text-grey-6b">coming soon</span>
          </span>
        )}
        {has('skip') && (
          <span className="ml-auto flex items-center gap-3">
            {lineOnly && <span className="text-[14px] text-grey-55">Not done it? Your fit works without it.</span>}
            <Button variant="outline" disabled={off} onClick={() => respond({ skipped: true }, 'Skip for now')}>
              Skip for now
            </Button>
          </span>
        )}
      </div>
      )}

      <SampleDialog
        open={dialog === 'samples'}
        title="Pick a sample session"
        note={
          lineOnly && samples.some((p) => p.s.kind === 'trackman_csv')
            ? 'These are simulated. Nothing is uploaded from your computer. TrackMan shots carry lie data too, so a session works instead of the test.'
            : 'These are simulated sessions. Nothing is uploaded from your computer.'
        }
        options={samples.map((p) => ({ id: `${p.golfer}/${p.s.sample_id}`, label: p.label }))}
        empty={golfers === null ? 'Loading the samples…' : 'No sample sessions are available right now.'}
        onPick={pickSample}
        onClose={() => setDialog(null)}
      />
      <SampleDialog
        open={dialog === 'photo'}
        title="Read it from a photo"
        note="Simulated photo reads: no photo is taken or analysed. Pick one to fill in your readings, then edit any number."
        options={PHOTO_READS}
        onPick={pickPhoto}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
