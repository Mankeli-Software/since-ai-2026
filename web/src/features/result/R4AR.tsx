import { Button, Eyebrow } from '@/components/studio'
import { arUrl } from './ar/arLink'
import { PhoneMock } from './ar/PhoneMock'
import { QrPlaceholder } from './ar/QrPlaceholder'
import { ResultsAside, useResultsChrome } from './chrome'
import { shortHead } from './compare/pair'
import { PhoneNote } from './PhoneBits'

const ASIDE_MESSAGE = 'Hold your phone where the ball would be. Check how the topline looks to you at address.'

/**
 * R4 "In your hands" (V3-R4-AR): QR-style picture + the real AR link, phone mock. No Next link.
 * Phones (M-R4, M-00 rule 8): no QR code; the carpet preview, then one "View in your room" button that opens
 * AR Quick Look / Scene Viewer directly.
 */
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
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_300px] min-[1400px]:grid-cols-[minmax(0,1fr)_340px] items-center gap-10 max-md:flex-none max-md:grid-cols-1 max-md:gap-4">
        <div className="flex min-w-0 flex-col gap-5 max-md:order-2 max-md:gap-3">
          <Eyebrow className="text-orange-hover max-md:hidden">See it in your hands</Eyebrow>
          <h1 className="m-0 font-display text-[72px] leading-[.86] font-extrabold uppercase max-md:text-[40px] max-md:leading-[.9]">
            Put it on your carpet.
          </h1>
          <p className="m-0 max-w-[520px] text-[20px] leading-[1.5] text-grey-c8 max-md:text-[16px]">
            Open it on your phone. The {shortHead(head)} appears at real size, so you can check how the topline and offset look at
            address.
          </p>
          <div className="flex flex-col gap-2 md:hidden">
            <Button href={url} variant="primary" className="min-h-[52px] w-full gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l9 5v10l-9 5-9-5V7z" />
                <path d="M3 7l9 5 9-5M12 12v10" />
              </svg>
              View in your room
            </Button>
            <span className="text-center text-[13px] text-grey-a3">Opens AR Quick Look on iPhone, Scene Viewer on Android</span>
          </div>
          <div className="flex items-center gap-6 max-md:hidden">
            <div className="flex flex-none flex-col items-center gap-2">
              <div className="rounded-16 bg-white p-3.5">
                <QrPlaceholder
                  seed={url}
                  className="block size-[160px] min-[1400px]:size-[200px]"
                  label="QR code placeholder for the AR link. Scanning is coming soon; the link is written next to it."
                />
              </div>
              <span className="text-[12px] text-grey-8f">Scan code coming soon</span>
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
        {/* Phones (M-R4): the phone mock becomes a full-width carpet preview (no phone frame or notch). */}
        <div className="contents max-md:order-1 max-md:block max-md:[&>div]:h-[300px] max-md:[&>div]:w-full max-md:[&>div]:rounded-18 max-md:[&>div]:border-0 max-md:[&>div]:shadow-none max-md:[&>div>span:first-of-type]:hidden max-md:[&_img]:top-[60px]">
          <PhoneMock head={head} />
        </div>
      </div>
      <PhoneNote text={ASIDE_MESSAGE} />
      <ResultsAside message={ASIDE_MESSAGE} chips={chips} />
    </>
  )
}
