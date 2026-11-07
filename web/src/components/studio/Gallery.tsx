import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Button,
  ClubImage,
  CloseCallBar,
  ConfidenceSegments,
  Eyebrow,
  FitterAvatar,
  Kbd,
  LogoMark,
  OptTile,
  ProvenancePill,
  RecapChip,
  SpecPartIcon,
  StatTile,
  StepBars,
  Wordmark,
  type ButtonSize,
  type ButtonVariant,
  type SpecPart,
} from '.'

/** Primitives gallery: `dev.html?ff=primitives`. Every primitive on a light card and on the dark bay. */

type Tone = 'light' | 'dark'

function Row({ name, tone, children }: { name: string; tone: Tone; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow size={11} className={tone === 'dark' ? 'text-grey-8f' : 'text-grey-55'}>
        {name}
      </Eyebrow>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

const parts: SpecPart[] = ['head', 'shaft', 'length', 'lie', 'grip']
const sizes: ButtonSize[] = ['sm', 'md', 'lg', 'xl']

function Showcase({ tone }: { tone: Tone }) {
  const dark = tone === 'dark'
  const [picked, setPicked] = useState(2)
  const [confidence, setConfidence] = useState(68)
  const variants: ButtonVariant[] = dark ? ['primary', 'lightOnDark', 'ghostOnDark'] : ['primary', 'dark', 'outline']

  return (
    <section
      aria-label={dark ? 'On the dark bay' : 'On a light card'}
      className={cn('flex flex-col gap-8 p-10', dark ? 'rounded-20 border border-grey-26 bg-bay' :'rounded-20 bg-washed-white text-midnight shadow-card')}
    >
      <h2 className="m-0 font-display text-[26px] font-bold uppercase">{dark ? 'Dark (.bg-bay)' : 'Light (talk card)'}</h2>

      <Row name="Button: variants (md)" tone={tone}>
        {variants.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
        <Button variant={variants[1]} disabled>
          Disabled
        </Button>
        <Button variant={variants[2]} href="#primitives">
          As a link
        </Button>
      </Row>
      <Row name="Button: sizes sm / md / lg / xl" tone={tone}>
        {sizes.map((s) => (
          <Button key={s} size={s} variant={s === 'lg' ? 'primary' : variants[1]}>
            Size {s}
          </Button>
        ))}
      </Row>

      <Row name="Eyebrow 13 / 11, Kbd" tone={tone}>
        <Eyebrow className={dark ? 'text-orange-hover' : 'text-orange-text'}>Fit confidence, measured</Eyebrow>
        <Eyebrow size={11} className={dark ? 'text-grey-a3' : 'text-grey-55'}>
          Small eyebrow
        </Eyebrow>
        <Kbd onDark={dark}>1</Kbd>
        <Kbd onDark={dark}>Enter</Kbd>
      </Row>

      <Row name="OptTile (number keys, selected state)" tone={tone}>
        <div className="grid w-full grid-cols-4 gap-3">
          {['Just started', '1–3 years', '3–10 years', '10+ years'].map((label, i) => (
            <OptTile key={label} kbd={i + 1} selected={picked === i} onClick={() => setPicked(i)}>
              {label}
            </OptTile>
          ))}
        </div>
      </Row>

      <Row name="ProvenancePill md (chat) / sm (Main)" tone={tone}>
        <ProvenancePill kind="measured" tone={tone} />
        <ProvenancePill kind="guess" tone={tone} />
        <ProvenancePill kind="chart" tone={tone} />
        <ProvenancePill kind="measured" tone={tone} size="sm" />
        <ProvenancePill kind="guess" tone={tone} size="sm" />
        <ProvenancePill kind="chart" tone={tone} size="sm" />
      </Row>

      <Row name="ConfidenceSegments + StepBars (header)" tone={tone}>
        <ConfidenceSegments value={confidence} />
        <ConfidenceSegments value={null} />
        <StepBars step={2} />
        <label className="flex items-center gap-2 text-[14px]">
          <span>Value</span>
          <input
            type="range"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-40 accent-tiger-orange"
          />
        </label>
      </Row>

      <Row name="LogoMark 34 / 30, Wordmark, FitterAvatar 44 / 36 / 28" tone={tone}>
        <span className="inline-flex items-center gap-3.5">
          <LogoMark size={34} color={dark ? '#F8F8F8' : '#0B0B0B'} />
          <Wordmark />
        </span>
        <LogoMark size={30} color={dark ? '#F8F8F8' : '#0B0B0B'} title="Takomo" />
        <FitterAvatar size={44} />
        <FitterAvatar size={36} />
        <FitterAvatar size={28} />
      </Row>

      <Row name="ClubImage (hero, render_face, missing slug → fallback)" tone={tone}>
        <ClubImage slug="201t-mkii" className={cn('h-[120px]', dark && 'drop-shadow-club')} alt="Takomo 201T MkII iron" />
        <ClubImage slug="201-mkii" variant="render_face" className="h-[120px]" />
        <ClubImage slug="does-not-exist" className="h-[120px]" alt="Missing club image" />
      </Row>

      <Row name="StatTile (plain, unit, compare)" tone={tone}>
        <div className="grid w-full grid-cols-4 gap-2.5">
          <StatTile tone={tone} label="Club speed" value="76" unit="mph" />
          <StatTile tone={tone} label="Launch" value="18.2°" />
          <StatTile tone={tone} label="Carry" value="144" compare="147" unit="m" />
          <StatTile tone={tone} label="Landing" value="47°" compare="44°" />
        </div>
      </Row>

      <Row name="CloseCallBar (with / without shares)" tone={tone}>
        <div className="flex w-full flex-col gap-4">
          <CloseCallBar tone={tone} a={{ label: '201T', share: 53 }} b={{ label: '201', share: 47 }} />
          <CloseCallBar tone={tone} a={{ label: '301 CB', share: 51 }} b={{ label: '301 MB', share: 49 }} showShares />
        </div>
      </Row>

      <Row name="SpecPartIcon (head active)" tone={tone}>
        {parts.map((p) => (
          <span
            key={p}
            className={cn('inline-flex size-[34px] items-center justify-center rounded-8', dark ? 'bg-grey-1a' : 'bg-grey-ed')}
            title={p}
          >
            <SpecPartIcon part={p} active={p === 'head'} color={!dark && p !== 'head' ? '#555555' : undefined} />
          </span>
        ))}
      </Row>

      <Row name="RecapChip (You told me)" tone={tone}>
        <Eyebrow className="mr-1.5 text-grey-5f">You told me</Eyebrow>
        <RecapChip label="10-year-old cavity backs" title="What's in the bag?" />
        <RecapChip label="7-iron about 165 m" title="7-iron carry?" />
        <RecapChip label="24 TrackMan shots" title="Real shots?" measured />
      </Row>
    </section>
  )
}

export function Gallery() {
  return (
    <main id="primitives" className="flex min-h-screen flex-col gap-10 bg-bay p-10 font-sans">
      <header className="flex items-center gap-5">
        <LogoMark />
        <Wordmark />
        <Eyebrow className="text-washed-white">Primitives</Eyebrow>
        <span className="h-px flex-1 bg-grey-3d" />
        <span className="text-[14px] text-grey-a3">web/src/components/studio</span>
      </header>
      <div className="grid gap-10 xl:grid-cols-2">
        <Showcase tone="light" />
        <Showcase tone="dark" />
      </div>
    </main>
  )
}
