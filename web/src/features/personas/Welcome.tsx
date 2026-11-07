import { Button, ClubImage, EnterKbd, Eyebrow, LogoMark, Wordmark, useEnterKey } from '@/components/studio'
import { ClubModel } from '@/features/stage3d/ClubModel'
import { convertProseUnits } from '@/lib/units'
import { cn } from '@/lib/utils'
import { useUnitsStore } from '@/store/units'
import { ownFittingHrefV3, PERSONAS, personaHrefV3 } from './personas'

const STEPS = [
  { n: '01', title: 'Talk', text: "How's your game? Type, tap, or voice it." },
  { n: '02', title: 'Bring proof', text: 'TrackMan shots, a screenshot, or your honest guess.' },
  { n: '03', title: 'See it fly', text: 'Your club in 3D, your carry, your dispersion.' },
  { n: '04', title: 'Decide', text: 'Every reason shown, close calls included.' },
]

/**
 * v3 C1 welcome (mockup V3-C1-Welcome), with the "Try as" simulated golfers under the CTA (L16). Enter starts.
 * Phones (< md, mockup M-01): 56px header, the club as a 250px banner on top, one column, full-width CTA and the
 * four steps as a list.
 */
export function Welcome() {
  useEnterKey(() => window.location.assign(ownFittingHrefV3()), true)
  const units = useUnitsStore((s) => s.units)

  return (
    <div className="bg-bay relative flex min-h-screen md:h-screen w-full flex-col overflow-hidden font-sans antialiased">
      {/* Desktop hero: glow and club fill the empty area right of the copy; the club is centred in it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-14 right-0 bottom-24 left-[max(760px,48%)] bg-[radial-gradient(ellipse_at_50%_56%,rgba(255,110,1,.2),transparent_62%)] max-md:hidden"
      />
      <ClubModel
        slug="201t-mkii"
        alt="Takomo 201T MkII iron"
        follow
        zoom={0.85}
        className="absolute top-14 right-0 bottom-24 left-[max(760px,48%)] aspect-auto drop-shadow-club-hero max-md:hidden"
      />
      <header className="flex items-center gap-5 px-14 pt-7 text-on-page max-md:h-14 max-md:gap-2 max-md:px-4 max-md:pt-0">
        <a
          href="/"
          aria-label="Takomo Fitter Studio, start"
          className="flex flex-none items-center gap-3.5 text-on-page no-underline max-md:-ml-2 max-md:size-11 max-md:justify-center"
        >
          <LogoMark className="max-md:h-6 max-md:w-[26px]" />
          <Wordmark className="max-md:hidden" />
        </a>
        <Eyebrow className="flex-none text-on-page">Fitter Studio</Eyebrow>
        <div className="h-px flex-1 bg-page-line-2 max-md:hidden" />
        <Eyebrow className="flex-none text-on-page-2 max-md:hidden">Honestly better golf</Eyebrow>
      </header>
      {/* Phone hero: the club as a banner above the copy (M-01) instead of floating behind it. */}
      <div
        aria-hidden="true"
        className="relative h-[250px] flex-none bg-[radial-gradient(ellipse_60%_60%_at_60%_60%,rgba(255,110,1,.25),transparent_70%)] md:hidden"
      >
        <ClubImage slug="201t-mkii" alt="" className="absolute top-0 right-5 h-[250px] w-auto drop-shadow-club-hero" />
      </div>
      <main className="relative flex flex-1 flex-col gap-[30px] px-14 pt-16 pb-14 md:min-h-0 max-md:gap-4 max-md:px-4 max-md:pt-0 max-md:pb-6 [@media(max-height:960px)]:gap-5 [@media(max-height:960px)]:pt-7 [@media(max-height:960px)]:pb-6 max-md:[@media(max-height:960px)]:gap-4 max-md:[@media(max-height:960px)]:pt-0 max-md:[@media(max-height:960px)]:pb-6">
        <h1 className="m-0 max-w-[820px] font-display text-[length:clamp(112px,16.7vh,150px)] leading-[.84] font-extrabold tracking-normal uppercase max-md:text-[56px] max-md:leading-[.88]">
          Let's find your fit. Honestly.
        </h1>
        <p className="m-0 max-w-[640px] text-[21px] leading-normal text-on-page-2 max-md:text-[17px] max-md:leading-[1.5]">
          A candid fitter in your pocket. Talk through your game, drop in real numbers if you have them, and see the exact reason for every spec before you spend a cent.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-[22px] max-md:flex-col max-md:items-stretch max-md:gap-3">
            <Button href={ownFittingHrefV3()} variant="primary" size="xl" aria-keyshortcuts="Enter" className="pr-5 max-md:min-h-[52px] max-md:w-full max-md:text-[18px]">
              Start fitting
              <EnterKbd tone="primary" />
            </Button>
          </div>
          <nav aria-labelledby="try-as" className="flex flex-wrap items-center gap-2">
            <span id="try-as" className="mr-1.5 text-[15px] text-on-page-2 max-md:w-full">
              Or try as a simulated golfer
            </span>
            {PERSONAS.map((p) => (
              <Button key={p.id} href={personaHrefV3(p)} variant="ghostOnDark" size="sm" title={convertProseUnits(p.teaser, units)} className="min-h-9 px-3.5 max-md:min-h-11">
                {p.name}, {p.age}
              </Button>
            ))}
          </nav>
        </div>
        <ol className="mt-auto mb-0 grid list-none grid-cols-4 gap-7 p-0 max-md:mt-2 max-md:grid-cols-1 max-md:gap-0">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={cn(
                'flex flex-col gap-2 border-t-2 pt-5',
                'max-md:grid max-md:grid-cols-[22px_minmax(0,1fr)] max-md:gap-x-3.5 max-md:gap-y-0.5 max-md:border-t max-md:border-page-line max-md:py-3',
                i === 0 ? 'border-tiger-orange' : 'border-page-line-2',
              )}
            >
              <span
                className={cn(
                  'font-display text-[18px] font-bold tabular-nums max-md:row-span-2 max-md:text-[16px] max-md:text-orange-on-page',
                  i === 0 ? 'text-orange-on-page' : 'text-on-page-3',
                )}
              >
                {s.n}
              </span>
              <span className="font-display text-[28px] leading-tight font-bold uppercase max-md:text-[20px]">{s.title}</span>
              <span className="text-[15px] leading-[1.45] text-on-page-2 max-md:leading-[1.4]">{s.text}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
