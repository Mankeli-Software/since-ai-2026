import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { useSession } from '@/store/session'
import { pickShaftForSpec } from './shafts'
import type { Spec, TinkerOverrides, TinkerResult } from './types'

export const DEFAULT_BASELINE_SPEC: Spec = {
  head: '201t-mkii',
  shaft: 'kbs-tour-regular',
  shaft_model: 'KBS Tour',
  flex: 'regular',
  material: 'steel',
  length_in: 0.0,
  lie_deg: 0,
  grip: 'standard',
  handedness: 'right',
  purchase: 'stock',
}

export function specToOverrides(spec: Spec): TinkerOverrides {
  return {
    head: spec.head,
    length_in: spec.length_in,
    lie_deg: spec.lie_deg,
    flex: spec.flex,
    material: spec.material,
    shaft: spec.shaft,
    grip: spec.grip,
    handedness: spec.handedness,
  }
}

export function overridesToSpec(overrides: TinkerOverrides, purchase: 'stock' | 'custom' = 'stock', shaftModel?: string | null): Spec {
  return {
    head: overrides.head,
    length_in: overrides.length_in,
    lie_deg: overrides.lie_deg,
    flex: overrides.flex,
    material: overrides.material,
    shaft: overrides.shaft,
    shaft_model: shaftModel ?? null,
    grip: overrides.grip,
    handedness: overrides.handedness,
    purchase,
  }
}

export function useTinker(initialBaseline?: Spec | null) {
  const sessionId = useSession((s) => s.sessionId)
  const sessionBest = useSession((s) => s.state?.best ?? null)
  const baseline = initialBaseline ?? sessionBest ?? DEFAULT_BASELINE_SPEC

  const [overrides, setOverrides] = useState<TinkerOverrides>(() => specToOverrides(baseline))
  const [tinkerResult, setTinkerResult] = useState<TinkerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track if any override differs from baseline
  const isTinkered =
    overrides.head !== baseline.head ||
    overrides.length_in !== baseline.length_in ||
    overrides.lie_deg !== baseline.lie_deg ||
    overrides.flex !== baseline.flex ||
    overrides.material !== baseline.material ||
    overrides.grip !== baseline.grip ||
    overrides.handedness !== baseline.handedness

  // Sync with baseline if baseline changes and we haven't tinkered yet
  useEffect(() => {
    if (!isTinkered && initialBaseline) {
      setOverrides(specToOverrides(initialBaseline))
    }
  }, [initialBaseline, isTinkered])

  const callTinkerApi = useCallback(
    async (nextOverrides: TinkerOverrides) => {
      setLoading(true)
      try {
        const patch = {
          head: nextOverrides.head,
          shaft: nextOverrides.shaft,
          length_in: nextOverrides.length_in,
          lie_deg: nextOverrides.lie_deg,
          grip: nextOverrides.grip,
          handedness: nextOverrides.handedness,
        }

        const effectiveSessionId = sessionId || 'dev-session'
        const { data, error } = await api.POST('/api/tinker', {
          body: {
            session_id: effectiveSessionId,
            spec: patch,
          },
        })

        if (data) {
          setTinkerResult(data as TinkerResult)
          if (sessionId && data.state) {
            useSession.getState().mergeState(data.state)
          }
        } else if (error) {
          // Provide fallback result for offline/dev preview
          const diffLabels: string[] = []
          if (nextOverrides.head !== baseline.head) diffLabels.push(`head: ${nextOverrides.head} (was ${baseline.head})`)
          if (nextOverrides.lie_deg !== baseline.lie_deg) {
            const dl = nextOverrides.lie_deg - baseline.lie_deg
            diffLabels.push(`${dl > 0 ? '+' : ''}${dl}° ${dl > 0 ? 'upright' : 'flat'}`)
          }
          if (nextOverrides.length_in !== baseline.length_in) {
            const dlen = nextOverrides.length_in - baseline.length_in
            diffLabels.push(`${dlen > 0 ? '+' : ''}${dlen.toFixed(2)} in`)
          }
          if (nextOverrides.flex !== baseline.flex) diffLabels.push(`flex: ${nextOverrides.flex}`)
          if (nextOverrides.material !== baseline.material) diffLabels.push(`material: ${nextOverrides.material}`)
          if (nextOverrides.grip !== baseline.grip) diffLabels.push(`grip: ${nextOverrides.grip}`)

          const purchaseChanged =
            nextOverrides.lie_deg !== 0 ||
            nextOverrides.length_in !== 0 ||
            nextOverrides.material === 'graphite'

          const currentState = useSession.getState().state
          const state: TinkerResult['state'] = currentState ?? {
            version: 1,
            evidence_version: 0,
            gate: 'confident',
          }

          setTinkerResult({
            buildable: true,
            diff_labels: diffLabels,
            purchase: purchaseChanged ? 'custom' : 'stock',
            purchase_changed: purchaseChanged,
            recommended_spec: baseline,
            spec: overridesToSpec(nextOverrides, purchaseChanged ? 'custom' : 'stock'),
            state,
          })
        }
      } catch (err) {
        console.warn('tinker error:', err)
      } finally {
        setLoading(false)
      }
    },
    [sessionId, baseline],
  )

  const updateOverride = useCallback(
    (patch: Partial<TinkerOverrides>) => {
      setOverrides((prev) => {
        const next: TinkerOverrides = { ...prev, ...patch }

        // If head, material, or flex changed, ensure shaft is compatible
        if (patch.head || patch.material || patch.flex) {
          const newHead = patch.head ?? prev.head
          const newMat = patch.material ?? prev.material
          const newFlex = patch.flex ?? prev.flex
          next.shaft = pickShaftForSpec(newHead, newMat, newFlex, prev.shaft)
        }

        // Debounce API call by 150 ms
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
          void callTinkerApi(next)
        }, 150)

        return next
      })
    },
    [callTinkerApi],
  )

  const resetToRecommended = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    const reset = specToOverrides(baseline)
    setOverrides(reset)
    setTinkerResult(null)
    void callTinkerApi(reset)
  }, [baseline, callTinkerApi])

  return {
    overrides,
    baseline,
    tinkerResult,
    isTinkered,
    loading,
    updateOverride,
    resetToRecommended,
    activeSpec: tinkerResult?.spec ?? overridesToSpec(overrides, baseline.purchase, baseline.shaft_model),
  }
}
