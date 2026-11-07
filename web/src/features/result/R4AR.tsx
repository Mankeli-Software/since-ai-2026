import { Button, Eyebrow } from '@/components/studio'
import { ArQr } from './ar/ArQr'
import { arUrl } from './ar/arLink'
import { PhoneMock } from './ar/PhoneMock'
import { ResultsAside, useResultsChrome } from './chrome'
import { shortHead } from './compare/pair'

const ASIDE_MESSAGE = 'Hold your phone where the ball would be. Check how the topline looks to you at address.'

/** R4 "In your hands" (V3-R4-AR): QR-style picture + the real AR link, phone mock. No Next link. */
export function R4AR() {
  const { data } = useResultsChrome()
  const best = data.best
  if (!best) return <p className="m-0 text-grey-a3">Your fit is on its way.</p>

  const head = best.head
  const url = arUrl(head)
  const runner = data.runnerUp && data.runnerUp.head !== head ? data.runnerUp.head : null
  const chips = [runner && `Show the ${shortHead(runner)} in AR too`, 'How much offset is that?'].filter((c): c is string => !!c)

  return (
    <>
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_300px] min-[1400px]:grid-cols-[minmax(0,1fr)_340px] items-center gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <Eyebrow className="text-orange-hover">See it in your hands</Eyebrow>
          <h1 className="m-0 font-display text-[72px] leading-[.86] font-extrabold uppercase">Put it on your carpet.</h1>
          <p className="m-0 max-w-[520px] text-[20px] leading-[1.5] text-grey-c8">
            Open it on your phone. The {shortHead(head)} appears at real size, so you can check how the topline and offset look at
            address.
          </p>
          <div className="flex items-center gap-6">
            <div className="flex flex-none flex-col items-center gap-2">
              <div className="rounded-16 bg-white p-3.5">
                <ArQr url={url} className="size-[160px] min-[1400px]:size-[200px]" />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-[15px] text-grey-c8">
              <span>iPhone: opens in AR Quick Look</span>
              <span>Android: opens in Scene Viewer</span>
              <span className="flex flex-col gap-0.5 pt-1">
                <span className="text-[13px] text-grey-8f">Open this link on your phone:</span>
                <a href={url} className="break-all text-[14px] text-orange-hover">
                  {url}
                </a>
              </span>
              <span className="pt-1.5">
                <Button href={url} variant="ghostOnDark" size="sm">
                  Open AR on this device
                </Button>
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 pt-1">
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="cursor-not-allowed border-0 bg-transparent p-0 text-[15px] whitespace-nowrap text-orange-hover underline opacity-50"
                >
                  Send the link to my phone
                </button>
                <span className="text-[13px] whitespace-nowrap text-grey-8f">Coming soon</span>
              </span>
            </div>
          </div>
        </div>
        <PhoneMock head={head} />
      </div>
      <ResultsAside message={ASIDE_MESSAGE} chips={chips} />
    </>
  )
}
