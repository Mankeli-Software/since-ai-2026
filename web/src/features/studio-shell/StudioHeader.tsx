import { useState } from 'react'
import { ConfidenceSegments, Eyebrow, LogoMark, StepBars, Wordmark } from '@/components/studio'
import { shortHead } from '@/features/result/compare/pair'
import { hasFlag } from '@/lib/flags'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'

export interface StudioHeaderProps {
  /** 'chat' shows "Fitter Studio" + step bars; 'results' shows "Your fit" and no steps (spec §2.1, §2.2). */
  variant: 'chat' | 'results'
  /** Chat phase only: 1..4 (see stepFor in ChatShell). */
  step?: number
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
      className="inline-flex h-8 flex-none items-center gap-1.5 rounded-full bg-grey-1a pr-2.5 pl-1.5"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#3D3D3D" strokeWidth="3" />
        {v > 0 && (
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="#FF6E01"
            strokeWidth="3"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            strokeLinecap="round"
            transform="rotate(-90 12 12)"
          />
        )}
      </svg>
      <span className="font-display text-[16px] font-bold tabular-nums">{pct === null ? '–' : `${pct}%`}</span>
    </span>
  )
}

/** Phone step row under the header (mockup M-02): four flexible bars + "Step N of 4". */
function PhoneSteps({ step, total = 4 }: { step: number; total?: number }) {
  const n = Math.max(0, Math.min(total, step))
  return (
    <div className="flex items-center gap-2.5 px-4 pb-2 md:hidden">
      <span className="flex flex-1 gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-[2px] transition-ui', i < n ? 'bg-tiger-orange' : 'bg-grey-2a')} />
        ))}
      </span>
      <span className="text-[13px] text-grey-a3">
        Step {n} of {total}
      </span>
    </div>
  )
}

/** The C1 welcome, keeping `?ff=` so the logo does not drop out of the v3 flow. */
function welcomeHref() {
  const ff = new URLSearchParams(location.search).get('ff')
  return ff ? `/studio.html?ff=${encodeURIComponent(ff).replace(/%2C/g, ',')}` : '/studio.html'
}

/**
 * Shared v3 header for both shells: logo, rule, steps (chat), fit confidence, Save to myTakomo.
 * Phones (< md, mockups M-02 / M-R1): a 56px bar with the mark, the eyebrow, a confidence ring and an icon-only
 * Save, plus the step bars on their own row below.
 */
export function StudioHeader({ variant, step, onBack }: StudioHeaderProps) {
  const { state, demo, saved, save, addUi, engine: sessionEngine } = useSession()
  const [copied, setCopied] = useState(false)
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)
  const engineParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('engine') : null
  const engine = engineParam === 'live' || engineParam === 'scripted' ? engineParam : sessionEngine
  const hdr = !hasFlag('nohdr')
  const missingCount = state?.missing?.length ?? 0

  return (
    <>
      <header
        className={cn(
          'flex shrink-0 items-center gap-5 px-14 pt-7 max-md:h-14 max-md:gap-2 max-md:px-4 max-md:pt-0',
          // All chips at 1280: tighten the spacing so nothing wraps or overflows.
          hdr && 'max-[1366px]:gap-4 max-[1366px]:px-10',
        )}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to your fit"
            className="-ml-2 inline-flex size-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent text-washed-white md:hidden"
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
            'flex flex-none items-center gap-3.5 no-underline max-md:-ml-2 max-md:size-11 max-md:justify-center',
            onBack && 'max-md:hidden',
          )}
        >
          <LogoMark className="max-md:h-6 max-md:w-[26px]" />
          <Wordmark className="max-md:hidden" />
        </a>
        <Eyebrow className="flex-none text-washed-white">{variant === 'chat' ? 'Fitter Studio' : 'Your fit'}</Eyebrow>
        <div className="h-px flex-1 bg-grey-3d max-md:hidden" />
        {demo && (
          <Eyebrow
            size={11}
            title="Simulated golfer"
            className="flex-none rounded-4 px-2 py-1 text-orange-light shadow-[inset_0_0_0_1px_var(--color-orange-light)] max-md:ml-auto max-md:px-1.5"
          >
            <span className="max-md:hidden">Simulated golfer</span>
            <span className="md:hidden">Simulated</span>
          </Eyebrow>
        )}
        {engine && (
          <Eyebrow
            size={11}
            className={cn(
              'flex-none rounded-4 max-md:hidden px-2 py-1 text-grey-c8 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]',
              hdr && 'max-[1366px]:hidden',
            )}
          >
            {engine === 'live' ? 'Live AI' : 'Replay'}
          </Eyebrow>
        )}
        {hdr && (
          <>
            {state?.best ? (
              <Eyebrow size={11} className="flex-none rounded-4 max-md:hidden px-2 py-1 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
                Current best: {shortHead(state.best.head)}
              </Eyebrow>
            ) : missingCount > 0 ? (
              <Eyebrow size={11} className="flex-none rounded-4 max-md:hidden px-2 py-1 text-grey-a3 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
                {missingCount} {missingCount === 1 ? 'input missing' : 'inputs missing'}
              </Eyebrow>
            ) : null}
            {state?.gate && (
              <Eyebrow size={11} className="flex-none rounded-4 max-md:hidden px-2 py-1 text-grey-c8 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
                {state.gate === 'provisional' ? 'Working fit' : 'Dialed in'}
              </Eyebrow>
            )}
          </>
        )}
        {variant === 'chat' && step != null && (
          // The step bars are the lowest-value item: with all chips showing they only fit on wide screens.
          <StepBars step={step} className={cn('max-md:hidden', hdr && 'max-[1640px]:hidden')} />
        )}
        <span className="flex flex-none items-center gap-2.5 max-md:hidden">
          <Eyebrow className="text-grey-a3">Fit confidence</Eyebrow>
          <ConfidenceSegments value={pct} showLabel={false} />
        </span>
        <span className={cn('md:hidden', !demo && 'ml-auto')}>
          <ConfidenceRing pct={pct} />
        </span>
        {hdr && (
          <button
            type="button"
            onClick={() => {
              addUi({
                type: 'data_import',
                prompt: 'Got shot data from your own 7-iron? A TrackMan CSV works best.',
                sources: ['csv', 'ball_line', 'skip'],
                club_hint: 'own_7i',
                reason_code: 'lie',
                append_to: null,
              })
            }}
            className="flex h-9 flex-none max-md:hidden cursor-pointer items-center gap-1.5 rounded-6 bg-transparent px-3 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)] transition-ui hover:shadow-[inset_0_0_0_1px_var(--color-grey-8f)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-[13px] font-semibold">Add data</span>
          </button>
        )}
        <div className="relative flex-none">
        <button
          type="button"
          disabled={!state}
          onClick={() => void save()}
          aria-label={saved ? (saved.status === 'ok' ? 'Saved to myTakomo' : 'Save not ready') : 'Save to myTakomo'}
          className="flex h-11 flex-none cursor-pointer items-center gap-2.5 rounded-6 bg-transparent px-3.5 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)] transition-ui hover:shadow-[inset_0_0_0_1px_var(--color-grey-8f)] disabled:cursor-default disabled:opacity-50 max-md:-mr-2 max-md:w-11 max-md:justify-center max-md:px-0 max-md:shadow-none"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          <span className="flex flex-col items-start gap-0.5 leading-none max-md:hidden">
            <span className="text-[11px] font-medium text-grey-a3">{saved ? (saved.status === 'ok' ? 'Saved to' : 'Save not ready') : 'Save to'}</span>
            <span className="text-[15px] font-semibold">myTakomo</span>
          </span>
        </button>
          {hdr && saved?.status === 'ok' && saved.resumeUrl && (
            <div className="absolute top-full right-0 mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-grey-a3 max-md:hidden">
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
                className="cursor-pointer text-orange-hover hover:underline"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </header>
      {variant === 'chat' && step != null && <PhoneSteps step={step} />}
    </>
  )
}
