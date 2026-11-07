import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'
import type { FittingState, UIBlock } from '@/api/client'
import { GenUiBlock } from '../genui/GenUiBlock'
import { btnCls, eyebrowCls } from '../genui/ui'
import { RecommendationCardView } from '../result/RecommendationCard'

interface NextQuestionResponse {
  kind: 'intake' | 'ball_line_offer' | 'precision_offer' | 'none'
  field?: string | null
  part?: string | null
  reason_code?: string | null
  expected_gain?: number | null
  component?: UIBlock | null
}

export function FormFallback() {
  const { sessionId, state, mergeState, setMode } = useSession()
  const [nq, setNq] = useState<NextQuestionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNextQuestion = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/next-question`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as NextQuestionResponse
      setNq(data)
    } catch (e) {
      setError(`Failed to load question: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void fetchNextQuestion()
  }, [fetchNextQuestion])

  const handleRespond = async (value: unknown) => {
    if (!sessionId || !nq) return

    // Case 1: Data import skip or import
    if (nq.component?.type === 'data_import') {
      const isSkip =
        value != null &&
        typeof value === 'object' &&
        'skipped' in value &&
        Boolean((value as { skipped: unknown }).skipped)
      if (isSkip && nq.field === 'ball_line_offer') {
        await patchProfile({
          ball_line_offer: { value: 'skip', source: 'questionnaire' },
        })
        return
      }
      // If an import was performed, the child component already posted to /api/sessions/{id}/imports
      // Re-fetch next question to proceed
      await fetchNextQuestion()
      return
    }

    const fieldName = nq.field
    if (!fieldName) return

    let finalVal: unknown = value
    let unit: string | undefined

    // Case 2: Body measure ({ field, value_cm, unit, raw })
    if (nq.component?.type === 'body_measure') {
      if (value != null && typeof value === 'object' && 'value_cm' in value) {
        finalVal = (value as { value_cm: number }).value_cm
        unit = 'cm'
      }
    } else if (nq.component?.type === 'slider') {
      // Case 3: Slider (null, number, or { value, measured })
      if (value != null && typeof value === 'object' && 'value' in value) {
        finalVal = (value as { value: number | null }).value
      }
    }

    if (
      (fieldName === 'score_bucket' || fieldName === 'age') &&
      typeof finalVal === 'string' &&
      /^\d+$/.test(finalVal)
    ) {
      finalVal = Number(finalVal)
    }

    await patchProfile({
      [fieldName]: {
        value: finalVal,
        unit,
        source: 'questionnaire',
      },
    })
  }

  const patchProfile = async (
    fields: Record<string, { value: unknown; unit?: string; source: 'questionnaire' }>,
  ) => {
    if (!sessionId) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/sessions/${sessionId}/profile`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`HTTP ${r.status}: ${text}`)
      }
      const data = (await r.json()) as { state: FittingState }
      mergeState(data.state)
      await fetchNextQuestion()
    } catch (e) {
      setError(`Failed to save answer: ${String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const hasBest = state?.best != null
  const showRec = nq?.kind === 'none' || (hasBest && nq?.kind !== 'intake' && !nq?.component)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-foreground">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <span className={eyebrowCls}>Fitting Form</span>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">
            {showRec ? 'Your Recommendation' : 'Quick Questionnaire'}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="font-display text-xs font-semibold uppercase tracking-wider"
          onClick={() => setMode('chat')}
        >
          Switch to Chat
        </Button>
      </div>

      {loading && !nq && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink-500">Loading next question...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 text-xs"
            onClick={() => void fetchNextQuestion()}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && showRec && state?.best && (
        <div className="flex flex-col gap-6">
          <RecommendationCardView
            spec={state.best}
            purchase={state.best.purchase}
            confidence={state.confidence ?? 0}
            gate={state.gate}
            strength={state.strength}
            runner_up={state.runner_up}
          />
          <div className="flex gap-3">
            <Button className={btnCls} onClick={() => setMode('chat')}>
              Talk to Fitter
            </Button>
          </div>
        </div>
      )}

      {!loading && !showRec && nq?.component && (
        <div className="flex flex-col gap-6">
          <GenUiBlock
            key={nq.field ?? nq.kind}
            id={nq.field ?? 'question'}
            block={nq.component}
            interactive={!submitting}
            busy={submitting}
            respond={(val) => void handleRespond(val)}
          />

          {hasBest && nq.kind !== 'intake' && (
            <div className="mt-8 border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-ink-500 hover:text-foreground"
                onClick={() => setNq({ kind: 'none' })}
              >
                Skip further questions and view recommendation
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
