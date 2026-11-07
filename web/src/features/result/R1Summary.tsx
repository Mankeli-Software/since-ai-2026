import { useState, type ReactNode } from 'react'
import { ClubImage, Eyebrow, SpecPartIcon, type ClubImageVariant, type SpecPart } from '@/components/studio'
import { ClubModel } from '@/features/stage3d/ClubModel'
import { cn } from '@/lib/utils'
import rawProductVideos from '../../../../fixtures/product_videos.json'
import { Text } from '../chat/Text'
import { ExamplePill, ResultsAside, ViewLink, useResultsChrome, type ResultsView } from './chrome'
import { ConfirmWithShots } from './ConfirmWithShots'
import { PURCHASE_COPY, STATUS_TOOLTIP } from './fixtures/commerce'
import type { HeadSlug, HeadVideoData, VideoItem } from './ProductVideo'
import { headBlurb, headName } from './specLabel'
import type { ResultsData } from './useResultsData'
import type { Spec } from './types'

const productVideos = rawProductVideos as unknown as Record<HeadSlug, HeadVideoData>

const R1B_MESSAGE =
  "We built this off your questionnaire answers—solid baseline, but still an estimate. If you want to be dead certain before dropping cash, hit 10 balls in a simulator and let real numbers lock it down."
const R1B_CHIPS = ['What do real shots change?', "Looks good, I'll take it now"]

const firstSentence = (s: string) => s.trim().split(/(?<=[.!?])\s+/)[0] ?? s

/** Hero line from the why_panel (tool output): the head reason + the flex reason, first sentence each. */
function whySentence(data: ResultsData): string | null {
  const items = data.why?.items ?? []
  const pick = (...parts: string[]) => items.find((i) => parts.includes(i.part))?.plain
  const lines = [pick('head'), pick('flex', 'shaft_model')].filter((x): x is string => !!x).map(firstSentence)
  return lines.length ? lines.join(' ') : null
}

const scoreOf = (data: ResultsData, head: string) => {
  const row = data.compare?.heads.find((h) => h.head === head)
  return row ? Math.round(row.score_total) : null
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6E01" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5 L9.5 18 L20 6" />
    </svg>
  )
}

function Hero({ best, data }: { best: Spec; data: ResultsData }) {
  const name = headName(best.head)
  const why = whySentence(data)
  const copy = PURCHASE_COPY[best.purchase]
  return (
    <div className="mt-2 grid grid-cols-[270px_minmax(0,1fr)] items-center gap-9">
      <div className="relative flex h-[270px] items-center justify-center rounded-18 border border-grey-26 bg-[radial-gradient(ellipse_80%_60%_at_50%_65%,rgba(255,110,1,.22),#121212_70%)]">
        <ClubModel
          slug={best.head}
          alt={`Takomo ${name} 7-iron`}
          className="absolute inset-0 aspect-auto drop-shadow-[0_30px_40px_rgba(0,0,0,.75)]"
        />
        <Eyebrow className="absolute top-2.5 left-2.5 rounded-3 bg-washed-white px-[7px] py-0.5 text-midnight">3D</Eyebrow>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <h1 className="m-0 font-display text-[104px] leading-[.84] font-extrabold uppercase">{name}</h1>
        <p className="m-0 max-w-[640px] text-[20px] leading-[1.45] text-washed-white">
          {why ? <Text text={why} /> : 'No guesswork, no marketing fluff. Every single spec has a reason below.'}
        </p>
        <ul title={STATUS_TOOLTIP} className="m-0 flex list-none flex-wrap items-center gap-x-[22px] gap-y-1 p-0 pt-0.5 pb-1">
          {copy.ticks.map((t) => (
            <li key={t} className="inline-flex items-center gap-2 text-[15px] text-washed-white">
              <Check />
              {t}
            </li>
          ))}
          <li className="inline-flex items-center">
            <ExamplePill />
          </li>
        </ul>
      </div>
    </div>
  )
}

function HeadCard({ spec, rank, score, strength }: { spec: Spec; rank: 1 | 2; score: number | null; strength?: string | null }) {
  const first = rank === 1
  const label = first ? (strength === 'low' ? 'Add data to firm this up' : '1st, your fit') : '2nd, close behind'
  return (
    <ViewLink
      view="compare"
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3.5 rounded-14 px-4 py-3 text-washed-white no-underline transition-ui',
        first ? 'border-2 border-tiger-orange bg-selected-dark' : 'border border-grey-26 bg-grey-12 hover:border-grey-3d',
      )}
    >
      <ClubImage slug={spec.head} className="h-[62px] w-auto flex-none" />
      <span className="flex min-w-0 flex-col gap-[3px]">
        <Eyebrow className={first ? 'text-orange-hover' : 'text-grey-8f'}>{label}</Eyebrow>
        <span className="font-display text-[22px] font-bold uppercase">{headName(spec.head)}</span>
        <span className="truncate text-[14px] text-grey-c8">{headBlurb(spec.head)}</span>
      </span>
      {score != null && (
        <span
          title="Fit score"
          className={cn('ml-auto font-display text-[28px] font-extrabold tabular-nums', first ? 'text-orange-hover' : 'text-grey-c8')}
        >
          <span className="sr-only">Fit score </span>
          {score}
        </span>
      )}
    </ViewLink>
  )
}

function DrillCard({ view, n, title, text, cta, preview }: { view: ResultsView; n: number; title: string; text: string; cta: string; preview: ReactNode }) {
  return (
    <ViewLink
      view={view}
      className="flex min-w-0 flex-col gap-2.5 rounded-16 border border-grey-26 bg-grey-12 p-3.5 text-washed-white no-underline transition-ui hover:border-grey-3d"
    >
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-10 bg-midnight">{preview}</div>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[18px] font-extrabold tabular-nums text-orange-text">{n}</span>
        <span className="font-display text-[22px] leading-none font-bold uppercase">{title}</span>
      </span>
      <span className="flex-1 text-[14px] leading-[1.4] text-grey-c8">{text}</span>
      <span className="font-display text-[15px] font-bold tracking-[0.04em] text-orange-hover uppercase">{cta}</span>
    </ViewLink>
  )
}

const PART_TILES: SpecPart[] = ['head', 'shaft', 'length', 'lie', 'grip']

function PartsPreview({ measured }: { measured: boolean }) {
  return (
    <div className="flex gap-2.5">
      {PART_TILES.map((p) => (
        <span key={p} className="inline-flex size-[38px] items-center justify-center rounded-8 bg-grey-1a">
          {/* Head and shaft come from shots when there are shots: orange. */}
          <SpecPartIcon part={p} active={measured && (p === 'head' || p === 'shaft')} />
        </span>
      ))}
    </div>
  )
}

function ComparePreview({ best, runnerUp }: { best: string; runnerUp: string | null }) {
  return (
    <>
      <ClubImage slug={best} className="absolute bottom-1.5 left-2.5 h-[60px] w-auto" />
      {runnerUp && <ClubImage slug={runnerUp} className="absolute bottom-1.5 left-[46px] h-[52px] w-auto opacity-50" />}
      <svg viewBox="0 0 260 110" className="absolute top-1.5 right-1.5 w-[72%]" aria-hidden="true">
        <path d="M10 100 C 80 26 170 22 212 100" fill="none" stroke="#F8F8F8" strokeWidth="1.5" />
        <path d="M10 100 C 76 8 168 4 200 100" fill="none" stroke="#FF6E01" strokeWidth="3" />
      </svg>
    </>
  )
}

function ArPreview({ head }: { head: string }) {
  return (
    <div className="relative h-[92px] w-[58px] overflow-hidden rounded-12 border-[3px] border-grey-26 bg-[linear-gradient(180deg,#6B6157,#4E4236)]">
      <ClubImage slug={head} className="absolute top-6 left-1 h-16 w-auto max-w-none -rotate-[14deg]" />
    </div>
  )
}

// ---- See it hit ----

const KIND_ORDER: VideoItem['kind'][] = ['official', 'influencer_witb']
const THUMBS: ClubImageVariant[] = ['hero', 'face', 'address', 'hero_back']

/** Up to 4 videos for the head: official first, then "in the bag". Third-party reviews are left out here. */
function pickVideos(head: string): VideoItem[] {
  const d = productVideos[head as HeadSlug]
  if (!d) return []
  return KIND_ORDER.flatMap((k) => d.videos.filter((v) => v.kind === k)).slice(0, 4)
}

function SeeItHit({ head }: { head: string }) {
  const videos = pickVideos(head)
  const [playing, setPlaying] = useState<VideoItem | null>(null)
  if (videos.length === 0) return null
  const name = headName(head)
  const ringed = playing?.id ?? videos[0].id
  return (
    <section aria-labelledby="see-it-hit" className="mt-9 flex flex-col gap-3">
      <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <h2 id="see-it-hit" className="m-0 font-display text-[26px] font-extrabold uppercase">
          See it hit
        </h2>
        <Eyebrow className="text-grey-8f">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'} of the {name}
        </Eyebrow>
        <span className="min-w-0 truncate text-[13px] text-grey-a3">Picked for you: {videos[0].title}</span>
      </span>
      {playing && (
        <div className="flex flex-col gap-2">
          <iframe
            className="aspect-video max-h-[460px] w-full rounded-12 border border-grey-26 bg-midnight"
            title={playing.title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.youtube_id)}?autoplay=1&rel=0&start=${Math.max(0, Math.floor(playing.start_s ?? 0))}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <span className="flex items-center gap-3 text-[13px] text-grey-a3">
            <span className="min-w-0 flex-1 truncate">
              {playing.title} · {playing.creator || playing.channel}
            </span>
            <button
              type="button"
              onClick={() => setPlaying(null)}
              className="cursor-pointer border-0 bg-transparent text-[13px] text-washed-white underline hover:text-orange-hover"
            >
              Close video
            </button>
          </span>
        </div>
      )}
      <div className="flex gap-3.5">
        {videos.map((v, i) => {
          const on = v.id === ringed
          return (
            <button
              key={v.id}
              type="button"
              aria-label={`Play ${v.title}`}
              aria-pressed={playing?.id === v.id}
              onClick={() => setPlaying(v)}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 border-0 bg-transparent p-0 text-left text-washed-white"
            >
              <span
                className={cn(
                  'relative block h-[150px] w-full overflow-hidden rounded-12 bg-[radial-gradient(ellipse_at_70%_40%,#2A2A2A,#0B0B0B_70%)]',
                  on ? 'shadow-[inset_0_0_0_2px_#FF6E01]' : 'shadow-[inset_0_0_0_1px_#262626]',
                )}
              >
                <ClubImage slug={head} variant={THUMBS[i % THUMBS.length]} className="absolute top-1.5 right-2 h-[136px] w-auto opacity-85" />
                <span
                  className={cn(
                    'absolute top-2 left-2 flex size-10 items-center justify-center rounded-full',
                    on ? 'bg-tiger-orange' : 'bg-washed-white',
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#0B0B0B" aria-hidden="true">
                    <path d="M7 4l13 8-13 8z" />
                  </svg>
                </span>
              </span>
              <span className="truncate text-[15px] font-semibold">{v.title}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** R1 "Your fit: summary first" (V3-R1), with the R1b aside when there are no measured shots (V3-R1b). */
export function R1Summary() {
  const { data } = useResultsChrome()
  const best = data.best
  if (!best) return <p className="text-grey-a3">Your fit is on its way.</p>

  const runnerUp = data.runnerUp && data.runnerUp.head !== best.head ? data.runnerUp : null
  const measured = !data.noSim
  const sameShaft = !runnerUp || runnerUp.shaft === best.shaft

  return (
    <>
      <Hero best={best} data={data} />

      {runnerUp && (
        <section aria-labelledby="two-best" className="mt-7 flex flex-col gap-2.5">
          <Eyebrow as="h2" id="two-best" className="m-0 text-grey-8f">
            {sameShaft ? 'Your two best heads, same shaft' : 'Your two best heads'}
          </Eyebrow>
          <div className="flex gap-3">
            <HeadCard spec={best} rank={1} score={scoreOf(data, best.head)} strength={data.state?.strength} />
            <HeadCard spec={runnerUp} rank={2} score={scoreOf(data, runnerUp.head)} />
          </div>
        </section>
      )}

      <div className="mt-5 grid grid-cols-3 gap-4">
        <DrillCard
          view="why"
          n={1}
          title="Why each part"
          text={measured ? 'Every spec backed by data. Head and shaft dialled in from what you actually hit.' : 'Every spec backed by data, and how sure we are of each.'}
          cta="See the reasons →"
          preview={<PartsPreview measured={measured} />}
        />
        <DrillCard
          view="compare"
          n={2}
          title="Compare heads"
          text="Swap the head and watch your flight change."
          cta="Compare →"
          preview={<ComparePreview best={best.head} runnerUp={runnerUp?.head ?? null} />}
        />
        <DrillCard
          view="ar"
          n={3}
          title="In your hands"
          text="Drop the 7-iron on your carpet at 1:1 scale."
          cta="Open AR →"
          preview={<ArPreview head={best.head} />}
        />
      </div>

      {data.latest('stock_vs_custom') && (
        <ViewLink
          view="stock"
          className="mt-5 flex items-center gap-4 rounded-14 border border-status-amber/60 bg-grey-12 px-5 py-4 text-washed-white no-underline transition-ui hover:border-status-amber"
        >
          <span className="size-2 flex-none rounded-full bg-status-amber" aria-hidden="true" />
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] font-bold uppercase">Stock or custom?</span>
            <span className="text-sm text-grey-c8">Your strike pattern calls for custom lie. See the tradeoff before giving up 30-day returns.</span>
          </span>
          <span className="ml-auto font-display text-[15px] font-bold uppercase tracking-[0.04em] text-orange-hover">Compare builds →</span>
        </ViewLink>
      )}

      <SeeItHit head={best.head} />

      {data.noSim && (
        <ResultsAside fallback={R1B_MESSAGE} chips={R1B_CHIPS}>
          <ConfirmWithShots
            confidence={data.state?.confidence ?? null}
            simulatorIds={data.latest('simulator_map')?.simulator_ids}
          />
        </ResultsAside>
      )}
    </>
  )
}
