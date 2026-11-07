import { useState } from 'react'
import { ConfidenceSegments, Eyebrow, LogoMark, ThemeToggle, Wordmark } from '@/components/studio'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'

export interface StudioHeaderProps {
  /** 'chat' shows "Fitter Studio"; 'results' shows "Your fit". */
  variant: 'chat' | 'results'
  /** Phone only (M-R2..R4): a back chevron replaces the logo, e.g. back to the results summary. */
  onBack?: () => void
}

/** Phone confidence pill (mockup M-02): a 24px ring + "NN%" on a dark pill. */
function ConfidenceRing({ pct }: { pct: number | null }) {
  const c = 2 * Math.PI * 9
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <span
      role="img"
      aria-label={pct === null ? 'Fit confidence not known yet' : `Fit confidence ${pct} percent`}
      className="inline-flex h-8 flex-none items-center gap-1.5 rounded-full bg-panel-2 pr-2.5 pl-1.5"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-page-line-2)" strokeWidth="3" />
        {v > 0 && (
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--color-tiger-orange)"
            strokeWidth="3"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            strokeLinecap="round"
            transform="rotate(-90 12 12)"
          />
        )}
      </svg>
      <span className="font-display text-[16px] font-bold tabular-nums text-on-page">{pct === null ? '–' : `${pct}%`}</span>
    </span>
  )
}

/** The C1 welcome, keeping `?ff=` so the logo does not drop out of the v3 flow. */
function welcomeHref() {
  const ff = new URLSearchParams(location.search).get('ff')
  return ff ? `/studio.html?ff=${encodeURIComponent(ff).replace(/%2C/g, ',')}` : '/studio.html'
}

/**
 * Shared v3 header for both shells: logo, rule, fit confidence, Save to myTakomo. The flow has no fixed number of
 * steps, so there is no progress bar.
 * Phones (< md, mockups M-02 / M-R1): a 56px bar with the mark, the eyebrow, a confidence ring and an icon-only Save.
 */
export function StudioHeader({ variant, onBack }: StudioHeaderProps) {
  const { state, demo, saved, save } = useSession()
  const [copied, setCopied] = useState(false)
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)

  return (
    <header className="flex shrink-0 items-center gap-5 px-14 pt-7 text-on-page max-md:h-14 max-md:gap-2 max-md:px-4 max-md:pt-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to your fit"
          className="-ml-2 inline-flex size-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent text-on-page md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      <a
        href={welcomeHref()}
        aria-label="Takomo Fitter Studio, start"
        className={cn(
          'flex flex-none items-center gap-3.5 text-on-page no-underline max-md:-ml-2 max-md:size-11 max-md:justify-center',
          onBack && 'max-md:hidden',
        )}
      >
        <LogoMark className="max-md:h-6 max-md:w-[26px]" />
        <Wordmark className="max-md:hidden" />
      </a>
      <Eyebrow className="flex-none text-on-page">{variant === 'chat' ? 'Fitter Studio' : 'Your fit'}</Eyebrow>
      <div className="h-px flex-1 bg-page-line-2 max-md:hidden" />
      {demo && (
        <Eyebrow
          size={11}
          title="Simulated golfer"
          className="flex-none rounded-4 px-2 py-1 text-orange-on-page shadow-[inset_0_0_0_1px_var(--color-orange-on-page)] max-md:ml-auto max-md:px-1.5"
        >
          <span className="max-md:hidden">Simulated golfer</span>
          <span className="md:hidden">Simulated</span>
        </Eyebrow>
      )}
      <span className="flex flex-none items-center gap-2.5 max-md:hidden">
        <Eyebrow className="text-on-page-2">Fit confidence</Eyebrow>
        <ConfidenceSegments value={pct} showLabel={false} />
      </span>
      <span className={cn('md:hidden', !demo && 'ml-auto')}>
        <ConfidenceRing pct={pct} />
      </span>
      <ThemeToggle />
      <div className="relative flex-none">
        <button
          type="button"
          disabled={!state}
          onClick={() => void save()}
          aria-label={saved ? (saved.status === 'ok' ? 'Saved to myTakomo' : 'Save not ready') : 'Save to myTakomo'}
          className="flex h-11 flex-none cursor-pointer items-center gap-2.5 rounded-6 bg-transparent px-3.5 text-on-page shadow-[inset_0_0_0_1px_var(--color-page-line-2)] transition-ui hover:shadow-[inset_0_0_0_1px_var(--color-on-page-3)] disabled:cursor-default disabled:opacity-50 max-md:-mr-2 max-md:w-11 max-md:justify-center max-md:px-0 max-md:shadow-none"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          <span className="flex flex-col items-start gap-0.5 leading-none max-md:hidden">
            <span className="text-[11px] font-medium text-on-page-2">{saved ? (saved.status === 'ok' ? 'Saved to' : 'Save not ready') : 'Save to'}</span>
            <span className="text-[15px] font-semibold">myTakomo</span>
          </span>
        </button>
        {saved?.status === 'ok' && saved.resumeUrl && (
          <div className="absolute top-full right-0 mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-on-page-2 max-md:hidden">
            <span className="max-w-[140px] truncate" title={saved.resumeUrl}>{saved.resumeUrl}</span>
            <button
              type="button"
              onClick={() => {
                try {
                  const full = new URL(saved.resumeUrl!, window.location.origin).href
                  void navigator.clipboard.writeText(full)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  // ignore
                }
              }}
              className="cursor-pointer text-orange-on-page hover:underline"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
