import { Button, Kbd, StatTile, useNumberKeys } from '@/components/studio'
import { distanceValue, speedValue } from '@/lib/units'
import { useUnitsStore, type Units } from '@/store/units'
import type { BlockProps } from '../types'
import { Answered } from './_parts/Answered'

export const type = 'outlier_review'

type Block = BlockProps<'outlier_review'>['block']
type Flag = Block['flags'][number]
type Action = Block['actions'][number]

const LABELS: Record<string, [string, string?]> = {
  n: ['Shots'],
  club_speed_mph: ['Club speed', 'mph'],
  carry_avg_yd: ['Carry average', 'yd'],
  carry_avg_m: ['Carry average', 'm'],
  claimed_carry_yd: ['Your number', 'yd'],
  claimed_carry_m: ['Your number', 'm'],
}
// Unit from the field suffix (carry_yd, club_speed_mph, launch_deg...).
const UNITS: [string, string][] = [['_yd', ' yd'], ['_m', ' m'], ['_mph', ' mph'], ['_deg', '°'], ['_rpm', ' rpm']]

const unitOf = (field?: string | null, units?: Units) => {
  if (units === 'metric') {
    if (field?.endsWith('_yd')) return ' m'
    if (field?.endsWith('_mph')) return ' km/h'
  }
  return UNITS.find(([s]) => field?.endsWith(s))?.[1] ?? ''
}
const nameOf = (field?: string | null) =>
  (field ?? '').replace(/_(yd|m|mph|deg|rpm)$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const num = (v: Flag['value'], field?: string | null, units?: Units) => {
  if (typeof v !== 'number') return String(v)
  if (units === 'metric') {
    if (field?.endsWith('_yd')) return String(distanceValue(v, 'metric', 1))
    if (field?.endsWith('_mph')) return String(speedValue(v, 'metric', 1))
  }
  return String(Math.round(v * 10) / 10)
}

// Plain words from the numbers only (the fitter's chat line carries the joke and the explanation).
function headline(f: Flag, units?: Units) {
  const val = f.value != null ? `${num(f.value, f.field, units)}${unitOf(f.field, units)}` : null
  if (f.shot_index != null) {
    const shot = `Shot ${f.shot_index + 1}`
    if (!val) return `${shot} looks like an outlier.`
    return /carry|total|distance/.test(f.field ?? '') ? `${shot} went ${val}.` : `${shot}: ${nameOf(f.field).toLowerCase()} ${val}.`
  }
  if (!val) return 'One shot looks like an outlier.'
  if (/carry/.test(f.field ?? '')) return `Your shots carry ${val}.`
  return `${nameOf(f.field) || 'Your shots'}: ${val}.`
}
const detail = (f: Flag) => (f.expected ? `Expected ${f.expected}.` : "That's way outside your normal strike window.")

/**
 * C5 / K4 odd-shot check: orange-tint callout, Keep it / Drop it (number keys 1-3), "N other shots stay in".
 * Payload unchanged: `{action, codes}` with action keep | exclude | confirm_value.
 */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'outlier_review'>) {
  const units = useUnitsStore((s) => s.units)
  const flags = block.flags
  const shotLevel = flags.some((f) => f.shot_index != null)
  const prompt = flags[0] ? headline(flags[0], units) : 'Odd shot check'
  const suggestedFlag = flags.find((f) => f.suggested_value != null)
  const suggested = suggestedFlag?.suggested_value
  const unit = unitOf(suggestedFlag?.field, units)
  const label = (a: Action) =>
    a === 'confirm_value'
      ? suggested != null ? `Use ${num(suggested, suggestedFlag?.field, units)}${unit}` : 'Use the measured value'
      : a === 'keep' ? (shotLevel ? 'Count this shot' : 'Keep my number')
      : shotLevel ? 'Toss it out'
      : flags.every((f) => f.code.startsWith('S')) ? 'Drop these shots' : "Don't use my number"
  const order: Action[] = ['keep', 'exclude', 'confirm_value']
  const actions = order.filter((a) => block.actions.includes(a))
  const codes = flags.map((f) => f.code)
  const live = interactive && !answer
  const choose = (a: Action) => respond({ action: a, codes }, label(a))
  // No Enter: keep and drop are equal choices, so neither is the default.
  useNumberKeys(actions.length, (i) => choose(actions[i]), live && !busy)
  if (!live) return <Answered prompt={prompt} answer={answer} />

  // Keep = outline; the "do it" action = dark (confirm_value when offered, else exclude). No orange in a callout.
  const dark: Action = block.actions.includes('confirm_value') ? 'confirm_value' : 'exclude'

  const n = block.shots_summary?.n
  const dropped = new Set(flags.filter((f) => f.shot_index != null).map((f) => f.shot_index)).size
  const stats = Object.entries(block.shots_summary ?? {}).filter(([k]) => k !== 'n')

  return (
    <div className="flex flex-col gap-3.5">
      {stats.length > 0 && (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}>
          {stats.map(([k, v]) => {
            const rawVal = typeof v === 'number' ? v : 0
            const displayVal = num(rawVal, k, units)
            const u = unitOf(k, units).trim() || (LABELS[k]?.[1] ?? '')
            return (
              <StatTile key={k} label={LABELS[k]?.[0] ?? nameOf(k)} value={displayVal} unit={u} />
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-3.5 rounded-10 bg-orange-tint px-4 py-3">
        <div className="flex flex-1 flex-col gap-1 text-[16px] leading-snug">
          {flags.map((f, i) => (
            <p key={`${f.code}-${i}`} className="m-0">
              <b className="font-bold">{headline(f, units)}</b> {detail(f)}
            </p>
          ))}
        </div>
        {actions.map((a, i) => (
          <Button
            key={a}
            size="sm"
            variant={a === dark ? 'dark' : 'outline'}
            disabled={busy}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => choose(a)}
            className="pr-2.5"
          >
            {label(a)}
            <Kbd onDark={a === dark} className="h-[22px] min-w-[22px] text-[12px]">{i + 1}</Kbd>
          </Button>
        ))}
      </div>
      {shotLevel && n != null && n > dropped && (
        <span className="text-[14px] text-grey-55">
          {n - dropped} other shot{n - dropped === 1 ? '' : 's'} stay in.
        </span>
      )}
    </div>
  )
}
