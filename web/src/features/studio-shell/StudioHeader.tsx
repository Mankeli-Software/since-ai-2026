import { ConfidenceSegments, Eyebrow, LogoMark, StepBars, Wordmark } from '@/components/studio'
import { useSession } from '@/store/session'

export interface StudioHeaderProps {
  /** 'chat' shows "Fitter Studio" + step bars; 'results' shows "Your fit" and no steps (spec §2.1, §2.2). */
  variant: 'chat' | 'results'
  /** Chat phase only: 1..4 (see stepFor in ChatShell). */
  step?: number
}

/** Shared v3 header for both shells: logo, rule, steps (chat), fit confidence, Save to myTakomo. */
export function StudioHeader({ variant, step }: StudioHeaderProps) {
  const { state, demo, saved, save } = useSession()
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)

  return (
    <header className="flex shrink-0 items-center gap-5 px-14 pt-7">
      <a href="/studio.html" aria-label="Takomo Fitter Studio, start" className="flex flex-none items-center gap-3.5 no-underline">
        <LogoMark />
        <Wordmark />
      </a>
      <Eyebrow className="flex-none text-washed-white">{variant === 'chat' ? 'Fitter Studio' : 'Your fit'}</Eyebrow>
      <div className="h-px flex-1 bg-grey-3d" />
      {demo && (
        <Eyebrow size={11} className="flex-none rounded-4 px-2 py-1 text-orange-light shadow-[inset_0_0_0_1px_var(--color-orange-light)]">
          Simulated golfer
        </Eyebrow>
      )}
      {variant === 'chat' && step != null && <StepBars step={step} />}
      <span className="flex flex-none items-center gap-2.5">
        <Eyebrow className="text-grey-a3">Fit confidence</Eyebrow>
        <ConfidenceSegments value={pct} />
      </span>
      <button
        type="button"
        disabled={!state}
        onClick={() => void save()}
        className="flex h-11 flex-none cursor-pointer items-center gap-2.5 rounded-6 bg-transparent px-3.5 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)] transition-ui hover:shadow-[inset_0_0_0_1px_var(--color-grey-8f)] disabled:cursor-default disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
        <span className="flex flex-col items-start gap-0.5 leading-none">
          <span className="text-[11px] font-medium text-grey-a3">{saved ? (saved.status === 'ok' ? 'Saved to' : 'Save not ready') : 'Save to'}</span>
          <span className="text-[15px] font-semibold">myTakomo</span>
        </span>
      </button>
    </header>
  )
}
