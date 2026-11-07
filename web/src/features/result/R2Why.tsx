import { lazy, Suspense, useMemo } from 'react'
import { Button, ClubImage, Eyebrow, SpecPartIcon, StatTile } from '@/components/studio'
import { cn } from '@/lib/utils'
import { useSession, type UiItem } from '@/store/session'
import type { CameraPreset, CameraPresetName } from '../stage3d'
import { StageBoundary } from '../studio-shell/StageBoundary'
import { ResultsAside, ResultsNext, WHY_PARTS, useResultsChrome, type WhyPart } from './chrome'
import type { Spec } from './types'
import { GRIP_BY_GLOVE } from './why/charts/GloveGripMap'
import { findItem, type GloveAnswer, type PartContent, type PartCtx } from './why/parts/content'
import { gripContent } from './why/parts/grip'
import { headContent } from './why/parts/head'
import { lengthContent } from './why/parts/length'
import { lieContent } from './why/parts/lie'
import { shaftContent } from './why/parts/shaft'

/**
 * R2 "Why each part" (spec §6, V3-R2-Head / -Why / -Length / -Lie / -Grip): one screen per part.
 *   grid 200px | 1fr | 270px: the part list, the reason (eyebrow, H1, reason, chart, stats, callout, actions,
 *   Forge link) and the 3D focus panel. Each part's content comes from why/parts/<part>.tsx.
 * The part lives in ?part= (chrome). The buy bar's Next chains Head → Shaft → Length → Lie → Grip → Compare heads.
 */

// Lazy so three.js loads after the screen (web/CLAUDE.md, 3D rules).
const ClubStage = lazy(() => import('../stage3d'))

const BUILD: Record<WhyPart, (ctx: PartCtx) => PartContent> = {
  head: headContent,
  shaft: shaftContent,
  length: lengthContent,
  lie: lieContent,
  grip: gripContent,
}

/** The glove the golfer picked in the latest answered glove card (a typed answer is matched to its options). */
function gloveFrom(ui: UiItem[]): GloveAnswer | null {
  for (let i = ui.length - 1; i >= 0; i--) {
    const { block, answer } = ui[i]
    if (block.type !== 'body_measure' || block.field !== 'glove' || !answer) continue
    const options = (block.options ?? []).map((o) => ({ id: o.id, label: o.label, sub: o.sub }))
    const v = answer.value
    const raw = v && typeof v === 'object' && 'value' in v ? (v as { value: unknown }).value : v
    const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    const hit = options.find((o) => o.id.toLowerCase() === s || o.label.toLowerCase() === s)
    const id = hit?.id ?? Object.keys(GRIP_BY_GLOVE).find((g) => g.toLowerCase() === s) ?? null
    return id ? { id, options } : null
  }
  return null
}

let webgl: boolean | undefined
function hasWebGL() {
  try {
    webgl ??= !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl')
  } catch {
    webgl = false
  }
  return webgl
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Camera presets for the tall, narrow R2 panel (about 270 x 600). The manifest's presets frame a wide stage
 * and crop the club here, so these pull back (metres, right-handed frame, mirrored by the stage for lefties):
 *   shaft   = the whole club from an oblique angle (shaft, and length with nothing highlighted)
 *   headFace = the head, closer and a little oblique
 *   grip    = the upper shaft and grip
 *   addressDTL = face-on at address, head and lower shaft, so the lie angle reads true
 */
const R2_PRESETS: Partial<Record<CameraPresetName, CameraPreset>> = {
  shaft: { position: [1.64, 0.5, 1.4], target: [0.24, 0.46, 0] },
  headFace: { position: [0.31, 0.12, 0.52], target: [0.01, 0.03, 0] },
  grip: { position: [0.92, 0.8, 0.61], target: [0.4, 0.7, 0] },
  addressDTL: { position: [0.1, 0.22, 1.9], target: [0.1, 0.2, 0] },
}

// ---- left: the part list ----

function PartList({ contents, active, onPick }: { contents: PartContent[]; active: WhyPart; onPick: (p: WhyPart) => void }) {
  return (
    <nav aria-label="Parts of your club">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {contents.map((c) => {
          const on = c.part === active
          return (
            <li key={c.part}>
              <button
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => onPick(c.part)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-12 border-0 px-3 py-2.5 text-left transition-ui',
                  on ? 'bg-washed-white text-midnight' : 'bg-transparent text-washed-white hover:bg-grey-12',
                )}
              >
                <span className={cn('inline-flex size-9 flex-none items-center justify-center rounded-[9px]', on ? 'bg-midnight' : 'bg-grey-1a')}>
                  <SpecPartIcon part={c.part} active={on} />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <Eyebrow size={11} className={on ? 'text-grey-55' : 'text-grey-8f'}>
                    {c.label}
                  </Eyebrow>
                  <span className="truncate font-display text-[19px] font-bold uppercase">{c.listValue}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ---- centre: the reason ----

function ProvenanceLine({ p, example }: { p: PartContent['provenance']; example: boolean }) {
  if (!p && !example) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[14px] text-grey-a3">
      {p && (
        <>
          {p.kind === 'measured' ? (
            <span aria-hidden="true" className="inline-block size-2 flex-none rounded-full bg-tiger-orange" />
          ) : (
            <span aria-hidden="true" className="inline-block size-[9px] flex-none rounded-full border-[1.5px] border-dashed border-grey-a3" />
          )}
          <span>
            <span className="sr-only">{p.kind === 'measured' ? 'Measured. ' : 'From a chart, not measured. '}</span>
            {p.text}
          </span>
        </>
      )}
      {example && (
        <span title="Example data from the design, not your fit" className="rounded-4 border border-grey-3d px-1.5 py-px font-display text-[11px] font-semibold tracking-[0.16em] text-grey-8f uppercase">
          Example
        </span>
      )}
    </span>
  )
}

function Callout({ c }: { c: NonNullable<PartContent['callout']> }) {
  const say = useSession((s) => s.say)
  const busy = useSession((s) => s.busy)
  if (c.tone === 'tint') {
    return (
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-12 bg-orange-tint px-4 py-3 text-midnight">
        <p className="m-0 min-w-[200px] flex-1 text-[15px] leading-[1.45]">
          <b>{c.title}</b> {c.body}
        </p>
        {c.action && (
          <Button variant="dark" size="sm" className="min-h-[42px]" disabled={busy} onClick={() => void say(c.action!.say)}>
            {c.action.label}
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-12 border border-grey-26 bg-grey-12 px-4 py-3">
      <span className="font-display text-[15px] font-bold tracking-[0.04em] whitespace-nowrap text-washed-white uppercase">{c.title}</span>
      <span className="text-[15px] leading-[1.45] text-grey-c8">{c.body}</span>
    </div>
  )
}

function ExternalIcon() {
  return (
    <svg width="0.85em" height="0.85em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

function Reason({ c, example }: { c: PartContent; example: boolean }) {
  const { go } = useResultsChrome()
  const n = c.stats.length
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Eyebrow className="text-grey-8f">{c.label}</Eyebrow>
        <h1 className="m-0 font-display text-[44px] leading-[.9] font-extrabold uppercase">{c.title}</h1>
        <ProvenanceLine p={c.provenance} example={example} />
      </div>
      <p className="m-0 text-[19px] leading-[1.45] text-grey-c8">{c.reason}</p>
      {c.chart}
      {n > 0 && (
        <div className={cn('grid gap-2.5', n >= 4 ? 'grid-cols-4 max-[1400px]:grid-cols-2' : 'grid-cols-3')}>
          {c.stats.map((s) => (
            <StatTile key={s.label} tone="dark" label={s.label} value={s.accent ? <span className="text-orange-hover">{s.value}</span> : s.value} />
          ))}
        </div>
      )}
      {c.callout && <Callout c={c.callout} />}
      {(c.actions.length > 0 || c.forge) && (
        <div className="mt-auto flex flex-wrap items-center gap-3">
          {c.actions.map((a) => (
            <Button key={a.label} variant={a.variant} onClick={() => go(a.view)}>
              {a.label}
            </Button>
          ))}
          {c.forge && (
            <a
              href={c.forge.href}
              target="_blank"
              rel="noopener noreferrer"
              title={c.forge.title}
              className="inline-flex items-center gap-1.5 text-[15px] text-orange-hover transition-ui hover:text-washed-white"
            >
              {c.forge.label}
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalIcon />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ---- right: the 3D focus panel ----

function FocusPanel({ best, stage }: { best: Spec; stage: PartContent['stage'] }) {
  const gl = hasWebGL()
  const still = (
    <ClubImage slug={best.head} className="absolute top-1/2 left-1/2 h-[46%] w-auto max-w-[90%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-35 grayscale-[.3]" />
  )
  const caption = `${stage.caption}${gl && stage.drag ? ' Drag to rotate.' : ''}`
  return (
    <figure className="relative m-0 min-h-[440px] overflow-hidden rounded-18 border border-grey-26 bg-[radial-gradient(ellipse_70%_50%_at_50%_55%,rgba(255,110,1,.14),#121212_72%)]">
      <div className="absolute inset-0">
        {gl ? (
          <StageBoundary fallback={still}>
            <Suspense fallback={still}>
              <ClubStage
                head={best.head}
                handedness={best.handedness}
                shaftMaterial={best.material}
                length={clamp(Math.abs(best.length_in) <= 3 ? best.length_in : best.length_in - 37, -1.5, 1.5)}
                lie={clamp(best.lie_deg, -3, 3)}
                grip={best.grip}
                focus={stage.focus}
                highlight={stage.highlight}
                cameraPresets={R2_PRESETS}
              />
            </Suspense>
          </StageBoundary>
        ) : (
          still
        )}
      </div>
      <Eyebrow className="pointer-events-none absolute top-3.5 left-3.5 z-[2] inline-flex items-center gap-2 text-grey-a3">
        <span className="rounded-3 bg-washed-white px-1.5 py-0.5 text-midnight">3D</span>
        Focus: {stage.label}
      </Eyebrow>
      <div className="pointer-events-none absolute right-4 z-[2] flex flex-col items-end gap-[3px] text-right" style={{ top: `${stage.at}%` }}>
        <span aria-hidden="true" className="h-px w-5 bg-tiger-orange" />
        <Eyebrow size={11} className="text-orange-hover">
          {stage.lines[0]}
        </Eyebrow>
        <span className="text-[12px] text-grey-c8">{stage.lines[1]}</span>
      </div>
      <figcaption className="pointer-events-none absolute right-3.5 bottom-3 left-3.5 z-[2] text-[12px] text-grey-8f">{caption}</figcaption>
    </figure>
  )
}

// ---- the screen ----

export function R2Why() {
  const { part, setPart, data } = useResultsChrome()
  const ui = useSession((s) => s.ui)
  const best = data.best
  const example = data.source === 'fixture'

  const contents = useMemo(() => {
    if (!best) return null
    const glove = example ? null : gloveFrom(ui)
    return WHY_PARTS.map((p) => BUILD[p]({ data, best, item: findItem(data, p), example, glove }))
  }, [data, best, example, ui])

  if (!best || !contents) {
    return (
      <>
        <p className="m-0 text-[19px] text-grey-c8">Your fit isn't ready yet. Answer a few more questions and every part shows up here.</p>
        <ResultsNext label="Compare heads" to={{ view: 'compare' }} />
      </>
    )
  }

  const c = contents.find((x) => x.part === part) ?? contents[0]
  return (
    <>
      <div className="grid flex-1 grid-cols-[200px_minmax(0,1fr)_270px] gap-7 max-[1400px]:grid-cols-[176px_minmax(0,1fr)_236px] max-[1400px]:gap-5">
        <PartList contents={contents} active={c.part} onPick={setPart} />
        <Reason key={c.part} c={c} example={example} />
        <FocusPanel best={best} stage={c.stage} />
      </div>
      <ResultsNext label={c.next.label} to={c.next.to} />
      <ResultsAside message={c.aside.message} chips={c.aside.chips} />
    </>
  )
}
