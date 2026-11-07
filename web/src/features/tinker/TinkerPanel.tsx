import { useCallback, type RefObject } from 'react'
import type { ClubStageHandle } from '../stage3d'
import { StockVsCustomView } from '../result/StockVsCustom'
import type { Flex, GripSize, HeadSlug, Material, Spec, TinkerOverrides, TinkerResult } from './types'

export interface TinkerPanelProps {
  stageRef?: RefObject<ClubStageHandle | null>
  baseline: Spec
  overrides: TinkerOverrides
  tinkerResult: TinkerResult | null
  isTinkered: boolean
  loading?: boolean
  onUpdateOverride: (patch: Partial<TinkerOverrides>) => void
  onReset: () => void
  className?: string
}

const HEAD_OPTIONS: { slug: HeadSlug; label: string; desc: string }[] = [
  { slug: '101-mkii', label: '101 MKII', desc: 'Game Improvement · Hollow Body' },
  { slug: '201-mkii', label: '201 MKII', desc: 'Players Distance · Cavity Back' },
  { slug: '201t-mkii', label: '201T MKII', desc: 'Tour Cavity · Precision Forged' },
  { slug: '301-cb', label: '301 CB', desc: 'Forged Cavity · Soft Carbon Steel' },
  { slug: '301-mb', label: '301 MB', desc: 'Forged Muscle Back · Workability' },
]

const FLEX_OPTIONS: { id: Flex; label: string; name: string }[] = [
  { id: 'lady', label: 'L', name: 'Lady' },
  { id: 'senior', label: 'A', name: 'Senior' },
  { id: 'regular', label: 'R', name: 'Regular' },
  { id: 'stiff', label: 'S', name: 'Stiff' },
  { id: 'x-stiff', label: 'X', name: 'X-Stiff' },
]

const MATERIAL_OPTIONS: { id: Material; label: string }[] = [
  { id: 'steel', label: 'Steel' },
  { id: 'graphite', label: 'Graphite' },
]

const GRIP_OPTIONS: { id: GripSize; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard', desc: 'Core .580 / Men standard' },
  { id: 'midsize', label: 'Midsize', desc: '+1/16" build' },
  { id: 'oversize', label: 'Jumbo', desc: '+1/8" Oversize' },
]

export function TinkerPanel({
  stageRef,
  baseline,
  overrides,
  tinkerResult,
  isTinkered,
  loading = false,
  onUpdateOverride,
  onReset,
  className = '',
}: TinkerPanelProps) {
  // 60fps rule: drive imperative updates straight to three.js ref without global re-renders
  const handleLengthInput = useCallback(
    (val: number) => {
      stageRef?.current?.setLength(val)
      onUpdateOverride({ length_in: val })
    },
    [stageRef, onUpdateOverride],
  )

  const handleLieInput = useCallback(
    (val: number) => {
      stageRef?.current?.setLie(val)
      onUpdateOverride({ lie_deg: val })
    },
    [stageRef, onUpdateOverride],
  )

  const handleMaterialChange = useCallback(
    (val: Material) => {
      stageRef?.current?.setShaftMaterial(val)
      onUpdateOverride({ material: val })
    },
    [stageRef, onUpdateOverride],
  )

  const handleGripChange = useCallback(
    (val: GripSize) => {
      stageRef?.current?.setGrip(val)
      onUpdateOverride({ grip: val })
    },
    [stageRef, onUpdateOverride],
  )

  const handleReset = useCallback(() => {
    stageRef?.current?.setLength(baseline.length_in)
    stageRef?.current?.setLie(baseline.lie_deg)
    stageRef?.current?.setGrip(baseline.grip)
    stageRef?.current?.setShaftMaterial(baseline.material)
    onReset()
  }, [baseline, stageRef, onReset])

  const lengthOffset = overrides.length_in
  const lieDeg = overrides.lie_deg

  const purchaseChanged =
    tinkerResult?.purchase_changed ??
    (overrides.lie_deg !== baseline.lie_deg ||
      overrides.length_in !== baseline.length_in ||
      overrides.material !== baseline.material)

  const isCustom = tinkerResult?.purchase === 'custom' || purchaseChanged

  return (
    <div className={`flex flex-col gap-5 text-washed-white ${className}`}>
      {/* Header with Title and Reset */}
      <div className="flex items-center justify-between border-b border-border-dark pb-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-washed-white">
            Tinker Specs
          </h2>
          <p className="text-xs text-ink-300">
            Adjust club specs live. The 3D model and ball flight update instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={!isTinkered}
          className={`rounded border px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
            isTinkered
              ? 'border-tiger-orange bg-tiger-orange/10 text-tiger-orange hover:bg-tiger-orange/20 cursor-pointer'
              : 'border-border-dark text-ink-500 opacity-50 cursor-not-allowed'
          }`}
        >
          Reset to Recommended
        </button>
      </div>

      {/* Diff Badges */}
      {tinkerResult?.diff_labels && tinkerResult.diff_labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-surface-dark-2 p-2.5">
          <span className="font-display text-xs font-bold uppercase text-ink-300">Diff vs Rec:</span>
          {tinkerResult.diff_labels.map((diff, i) => (
            <span
              key={i}
              className="rounded bg-surface-dark-3 border border-tiger-orange/40 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wide text-tiger-orange"
            >
              {diff}
            </span>
          ))}
          {loading && <span className="text-xs text-ink-400 italic">updating...</span>}
        </div>
      )}

      {/* Head Selector */}
      <div className="flex flex-col gap-2">
        <label className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
          Club Head
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {HEAD_OPTIONS.map((h) => {
            const isSelected = overrides.head === h.slug
            const isBaseline = baseline.head === h.slug
            return (
              <button
                key={h.slug}
                type="button"
                onClick={() => onUpdateOverride({ head: h.slug })}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-tiger-orange bg-tiger-orange/15 ring-1 ring-tiger-orange'
                    : 'border-border-dark bg-surface-dark-2 hover:border-ink-400'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-display text-base font-bold uppercase tracking-wide text-washed-white">
                    {h.label}
                  </span>
                  {isBaseline && (
                    <span className="rounded bg-surface-dark-3 px-1.5 py-0.2 text-[10px] uppercase font-semibold text-tiger-orange">
                      Rec
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-ink-300 leading-tight mt-0.5">{h.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Shaft Flex & Material */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Shaft Material */}
        <div className="flex flex-col gap-2">
          <label className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
            Shaft Material
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MATERIAL_OPTIONS.map((m) => {
              const isSelected = overrides.material === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleMaterialChange(m.id)}
                  className={`rounded-md border py-2 text-center font-display text-sm font-semibold uppercase tracking-wider transition-colors ${
                    isSelected
                      ? 'border-tiger-orange bg-tiger-orange text-midnight-black font-bold'
                      : 'border-border-dark bg-surface-dark-2 text-ink-200 hover:border-ink-400'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Shaft Flex */}
        <div className="flex flex-col gap-2">
          <label className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
            Shaft Flex
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {FLEX_OPTIONS.map((f) => {
              const isSelected = overrides.flex === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  title={f.name}
                  onClick={() => onUpdateOverride({ flex: f.id })}
                  className={`flex flex-col items-center justify-center rounded-md border py-1.5 transition-colors ${
                    isSelected
                      ? 'border-tiger-orange bg-tiger-orange text-midnight-black font-bold'
                      : 'border-border-dark bg-surface-dark-2 text-ink-200 hover:border-ink-400'
                  }`}
                >
                  <span className="font-display text-sm font-bold uppercase leading-none">{f.label}</span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">{f.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Shaft Auto-switch notice */}
      {tinkerResult?.shaft_auto_switched && (
        <div className="rounded border border-tiger-orange/40 bg-tiger-orange/10 p-3 text-xs text-washed-white">
          <span className="font-bold text-tiger-orange">Shaft auto-switched: </span>
          <span>{tinkerResult.shaft_auto_switched}</span>
        </div>
      )}

      {/* Shaft comparison card if shaft changed */}
      {tinkerResult?.shaft_comparison && (
        <div className="rounded-lg border border-border-dark bg-surface-dark-2 p-3 text-xs">
          <span className="font-display font-bold uppercase tracking-wider text-ink-300 mb-2 block">
            Shaft Comparison
          </span>
          <div className="grid grid-cols-2 gap-3 divide-x divide-border-dark">
            <div>
              <span className="text-[10px] uppercase font-bold text-ink-400 block mb-1">Recommended</span>
              <p className="font-bold text-washed-white">
                {String((tinkerResult.shaft_comparison.from as Record<string, unknown>)?.model ?? 'Current')}
              </p>
              <p className="text-ink-300">
                {String((tinkerResult.shaft_comparison.from as Record<string, unknown>)?.weight_g ?? '')}g ·{' '}
                {String((tinkerResult.shaft_comparison.from as Record<string, unknown>)?.flex ?? '')}
              </p>
            </div>
            <div className="pl-3">
              <span className="text-[10px] uppercase font-bold text-tiger-orange block mb-1">Your Tinker</span>
              <p className="font-bold text-washed-white">
                {String((tinkerResult.shaft_comparison.to as Record<string, unknown>)?.model ?? 'New')}
              </p>
              <p className="text-ink-300">
                {String((tinkerResult.shaft_comparison.to as Record<string, unknown>)?.weight_g ?? '')}g ·{' '}
                {String((tinkerResult.shaft_comparison.to as Record<string, unknown>)?.flex ?? '')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sliders: Length & Lie */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Length Slider & Stepper */}
        <div className="flex flex-col gap-2 rounded-lg border border-border-dark bg-surface-dark-2 p-3">
          <div className="flex items-center justify-between">
            <label htmlFor="tinker-length-slider" className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
              Length (vs 37" standard)
            </label>
            <span className="font-display text-base font-bold text-tiger-orange">
              {lengthOffset === 0 ? 'Standard (37")' : `${lengthOffset > 0 ? '+' : ''}${lengthOffset.toFixed(2)} in`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease club length"
              onClick={() => handleLengthInput(Math.max(-1.5, lengthOffset - 0.25))}
              className="flex h-8 w-8 items-center justify-center rounded border border-border-dark bg-surface-dark-3 font-bold text-washed-white hover:border-ink-400"
            >
              −
            </button>
            <input
              id="tinker-length-slider"
              type="range"
              min="-1.5"
              max="1.5"
              step="0.25"
              value={lengthOffset}
              onChange={(e) => handleLengthInput(parseFloat(e.target.value))}
              onPointerMove={(e) => {
                if (e.buttons > 0) handleLengthInput(parseFloat(e.currentTarget.value))
              }}
              className="flex-1 accent-tiger-orange cursor-pointer"
            />
            <button
              type="button"
              aria-label="Increase club length"
              onClick={() => handleLengthInput(Math.min(1.5, lengthOffset + 0.25))}
              className="flex h-8 w-8 items-center justify-center rounded border border-border-dark bg-surface-dark-3 font-bold text-washed-white hover:border-ink-400"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-ink-400">
            <span>-1.5"</span>
            <span>Standard</span>
            <span>+1.5"</span>
          </div>
        </div>

        {/* Lie Angle Slider & Stepper */}
        <div className="flex flex-col gap-2 rounded-lg border border-border-dark bg-surface-dark-2 p-3">
          <div className="flex items-center justify-between">
            <label htmlFor="tinker-lie-slider" className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
              Lie Angle
            </label>
            <span className="font-display text-base font-bold text-tiger-orange">
              {lieDeg === 0 ? 'Standard (62°)' : `${lieDeg > 0 ? '+' : ''}${lieDeg}° ${lieDeg > 0 ? 'Upright' : 'Flat'}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease lie angle"
              onClick={() => handleLieInput(Math.max(-3, lieDeg - 1))}
              className="flex h-8 w-8 items-center justify-center rounded border border-border-dark bg-surface-dark-3 font-bold text-washed-white hover:border-ink-400"
            >
              −
            </button>
            <input
              id="tinker-lie-slider"
              type="range"
              min="-3"
              max="3"
              step="1"
              value={lieDeg}
              onChange={(e) => handleLieInput(parseInt(e.target.value, 10))}
              onPointerMove={(e) => {
                if (e.buttons > 0) handleLieInput(parseInt(e.currentTarget.value, 10))
              }}
              className="flex-1 accent-tiger-orange cursor-pointer"
            />
            <button
              type="button"
              aria-label="Increase lie angle"
              onClick={() => handleLieInput(Math.min(3, lieDeg + 1))}
              className="flex h-8 w-8 items-center justify-center rounded border border-border-dark bg-surface-dark-3 font-bold text-washed-white hover:border-ink-400"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-ink-400">
            <span>-3° Flat</span>
            <span>Standard</span>
            <span>+3° Upright</span>
          </div>
        </div>
      </div>

      {/* Grip Size */}
      <div className="flex flex-col gap-2">
        <label className="font-display text-xs font-bold uppercase tracking-wider text-ink-300">
          Grip Size
        </label>
        <div className="grid grid-cols-3 gap-2">
          {GRIP_OPTIONS.map((g) => {
            const isSelected = overrides.grip === g.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGripChange(g.id)}
                className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-colors ${
                  isSelected
                    ? 'border-tiger-orange bg-tiger-orange text-midnight-black font-bold'
                    : 'border-border-dark bg-surface-dark-2 text-ink-200 hover:border-ink-400'
                }`}
              >
                <span className="font-display text-sm font-bold uppercase leading-none">{g.label}</span>
                <span className="text-[10px] opacity-75 mt-0.5">{g.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Stock vs Custom Warning */}
      {isCustom && (
        <div className="rounded-lg border border-amber-600/40 bg-surface-dark-2 p-4 text-washed-white">
          <StockVsCustomView
            question="Your changes require a Custom Order. Stock sets include a 30-day trial return; custom builds are non-returnable."
            reasons={tinkerResult?.reasons && tinkerResult.reasons.length > 0 ? tinkerResult.reasons : ['Lie, length, or material deviates from standard stock specs.']}
            stockReturnDays={30}
            customReturnable={false}
            locked={false}
            picked="custom"
            onPick={(v) => {
              if (v === 'stock') {
                handleReset()
              }
            }}
          />
        </div>
      )}

      {/* Unmodelled Simulator Details */}
      {tinkerResult?.not_modelled && tinkerResult.not_modelled.length > 0 && (
        <div className="text-[11px] text-ink-400 italic">
          * Radical honesty: {tinkerResult.not_modelled.join(', ')}.
        </div>
      )}

      {/* Buildability check feedback if invalid */}
      {tinkerResult?.buildable === false && (
        <div className="rounded border border-destructive bg-destructive/15 p-3 text-xs text-destructive">
          <p className="font-bold">Not buildable as configured:</p>
          <ul className="list-disc pl-4 mt-1">
            {tinkerResult.reasons?.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
