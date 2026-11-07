import { useState } from 'react'
import { ConfidenceSegments, Eyebrow, LogoMark, StepBars, Wordmark } from '@/components/studio'
import { shortHead } from '@/features/result/compare/pair'
import { hasFlag } from '@/lib/flags'
import { useSession } from '@/store/session'

export interface StudioHeaderProps {
  /** 'chat' shows "Fitter Studio" + step bars; 'results' shows "Your fit" and no steps (spec §2.1, §2.2). */
  variant: 'chat' | 'results'
  /** Chat phase only: 1..4 (see stepFor in ChatShell). */
  step?: number
}

/** The C1 welcome, keeping `?ff=` so the logo does not drop out of the v3 flow. */
function welcomeHref() {
  const ff = new URLSearchParams(location.search).get('ff')
  return ff ? `/studio.html?ff=${encodeURIComponent(ff).replace(/%2C/g, ',')}` : '/studio.html'
}

/** Shared v3 header for both shells: logo, rule, steps (chat), fit confidence, Save to myTakomo. */
export function StudioHeader({ variant, step }: StudioHeaderProps) {
  const { state, demo, saved, save, addUi, engine: sessionEngine } = useSession()
  const [copied, setCopied] = useState(false)
  const pct = state?.confidence == null ? null : Math.round(state.confidence * 100)
  const engineParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('engine') : null
  const engine = engineParam === 'live' || engineParam === 'scripted' ? engineParam : sessionEngine
  const hdr = hasFlag('hdr')
  const missingCount = state?.missing?.length ?? 0

  return (
    <header className="flex shrink-0 items-center gap-5 px-14 pt-7">
      <a href={welcomeHref()} aria-label="Takomo Fitter Studio, start" className="flex flex-none items-center gap-3.5 no-underline">
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
      {engine && (
        <Eyebrow size={11} className="flex-none rounded-4 px-2 py-1 text-grey-c8 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
          {engine === 'live' ? 'Live AI' : 'Replay'}
        </Eyebrow>
      )}
      {hdr && (
        <>
          {state?.best ? (
            <Eyebrow size={11} className="flex-none rounded-4 px-2 py-1 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
              Current best: {shortHead(state.best.head)}
            </Eyebrow>
          ) : missingCount > 0 ? (
            <Eyebrow size={11} className="flex-none rounded-4 px-2 py-1 text-grey-a3 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
              {missingCount} {missingCount === 1 ? 'input missing' : 'inputs missing'}
            </Eyebrow>
          ) : null}
          {state?.gate && (
            <Eyebrow size={11} className="flex-none rounded-4 px-2 py-1 text-grey-c8 shadow-[inset_0_0_0_1px_var(--color-grey-3d)]">
              {state.gate === 'provisional' ? 'Provisional' : 'Confident'}
            </Eyebrow>
          )}
        </>
      )}
      {variant === 'chat' && step != null && <StepBars step={step} />}
      <span className="flex flex-none items-center gap-2.5">
        <Eyebrow className="text-grey-a3">Fit confidence</Eyebrow>
        <ConfidenceSegments value={pct} showLabel={false} />
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
          className="flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-6 bg-transparent px-3 text-washed-white shadow-[inset_0_0_0_1px_var(--color-grey-3d)] transition-ui hover:shadow-[inset_0_0_0_1px_var(--color-grey-8f)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-[13px] font-semibold">Add data</span>
        </button>
      )}
      <div className="flex flex-col items-end gap-1">
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
        {hdr && saved?.status === 'ok' && saved.resumeUrl && (
          <div className="flex items-center gap-1.5 text-[11px] text-grey-a3">
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
  )
}
