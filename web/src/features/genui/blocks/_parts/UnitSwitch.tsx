import { useUnitsStore, type Units } from '@/store/units'
import { Segmented } from './Segmented'

/**
 * Metric / imperial switch for a card that shows unit values (#216). One shared choice: it writes `useUnitsStore`
 * (kept in localStorage), so every other card and the results follow it. `labels` names the units this card shows,
 * e.g. `{ metric: 'm', imperial: 'yd' }`. Display only: a card converts back to its own unit before it sends.
 */
export function UnitSwitch({ labels, disabled, className }: { labels: Record<Units, string>; disabled?: boolean; className?: string }) {
  const units = useUnitsStore((s) => s.units)
  return (
    <Segmented
      size="sm"
      label="Units"
      value={units}
      onChange={(u) => useUnitsStore.getState().setUnits(u)}
      disabled={disabled}
      className={className}
      options={[
        { id: 'metric', label: labels.metric },
        { id: 'imperial', label: labels.imperial },
      ]}
    />
  )
}
