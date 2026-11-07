import { Button, EnterKbd, Eyebrow, LogoMark, Wordmark, useEnterKey } from '@/components/studio'
import { ClubModel } from '@/features/stage3d/ClubModel'
import { cn } from '@/lib/utils'
import { ownFittingHrefV3, PERSONAS, personaHrefV3 } from './personas'

const STEPS = [
  { n: '01', title: 'Talk', text: "How's your game? Type, tap, or voice it." },
  { n: '02', title: 'Bring proof', text: 'TrackMan shots, a screenshot, or your honest guess.' },
  { n: '03', title: 'See it fly', text: 'Your club in 3D, your carry, your dispersion.' },
  { n: '04', title: 'Decide', text: 'Every reason shown, close calls included.' },
]

/** v3 C1 welcome (mockup V3-C1-Welcome), with the "Try as" simulated golfers under the CTA (L16). Enter starts. */
export function Welcome() {
  useEnterKey(() => window.location.assign(ownFittingHrefV3()), true)
  return (
    <div className="bg-bay relative flex min-h-screen w-full flex-col overflow-hidden font-sans antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[60px] -right-20 size-[760px] bg-[radial-gradient(ellipse_at_50%_55%,rgba(255,110,1,.2),transparent_62%)]"
      />
      <ClubModel
        slug="201t-mkii"
        alt="Takomo 201T MkII iron"
        className="absolute top-[70px] right-[20px] h-[680px] drop-shadow-club-hero [@media(max-height:860px)]:top-[44px] [@media(max-height:860px)]:right-[30px] [@media(max-height:860px)]:h-[610px]"
      />
      <header className="flex items-center gap-5 px-14 pt-7">
        <a href="/" aria-label="Takomo Fitter Studio, start" className="flex flex-none items-center gap-3.5 no-underline">
          <LogoMark />
          <Wordmark />
        </a>
        <Eyebrow className="flex-none text-washed-white">Fitter Studio</Eyebrow>
        <div className="h-px flex-1 bg-grey-3d" />
        <Eyebrow className="flex-none text-grey-a3">Honestly better golf</Eyebrow>
      </header>
      <main className="relative flex flex-1 flex-col gap-[30px] px-14 pt-16 pb-14 [@media(max-height:860px)]:gap-6 [@media(max-height:860px)]:pt-9 [@media(max-height:860px)]:pb-8">
        <Eyebrow className="text-orange-hover">Takomo Fitter Studio</Eyebrow>
        <h1 className="m-0 max-w-[820px] font-display text-[length:clamp(112px,16.7vh,150px)] leading-[.84] font-extrabold tracking-normal uppercase">
          Let's find your fit. Honestly.
        </h1>
        <p className="m-0 max-w-[640px] text-[21px] leading-normal text-grey-c8">
          A candid fitter in your pocket. Talk through your game, drop in real numbers if you have them, and see the exact reason for every spec before you spend a cent.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-[22px]">
            <Button href={ownFittingHrefV3()} variant="primary" size="xl" aria-keyshortcuts="Enter" className="pr-5">
              Start fitting
              <EnterKbd tone="primary" />
            </Button>
            <span className="text-[16px] text-grey-a3">About 4 minutes. Save progress anytime.</span>
          </div>
          <nav aria-labelledby="try-as" className="flex flex-wrap items-center gap-2">
            <span id="try-as" className="mr-1.5 text-[15px] text-grey-a3">
              Or try as a simulated golfer
            </span>
            {PERSONAS.map((p) => (
              <Button key={p.id} href={personaHrefV3(p)} variant="ghostOnDark" size="sm" title={p.teaser} className="min-h-9 px-3.5">
                {p.name}, {p.age}
              </Button>
            ))}
          </nav>
        </div>
        <ol className="mt-auto mb-0 grid list-none grid-cols-4 gap-7 p-0">
          {STEPS.map((s, i) => (
            <li key={s.n} className={cn('flex flex-col gap-2 border-t-2 pt-5', i === 0 ? 'border-tiger-orange' : 'border-grey-3d')}>
              <span className={cn('font-display text-[18px] font-bold tabular-nums', i === 0 ? 'text-orange-hover' : 'text-grey-8f')}>{s.n}</span>
              <span className="font-display text-[28px] leading-tight font-bold uppercase">{s.title}</span>
              <span className="text-[15px] leading-[1.45] text-grey-c8">{s.text}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
