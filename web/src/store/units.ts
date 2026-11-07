import { create } from 'zustand'

export type Units = 'imperial' | 'metric'

const STORAGE_KEY = 'takomo_units'

// Regions that use imperial units. Anything else uses metric.
const IMPERIAL_REGIONS = ['US', 'LR', 'MM']

function getInitialUnits(): Units {
  if (typeof window === 'undefined') return 'imperial'
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === 'imperial' || val === 'metric') return val
  } catch {
    // ignore
  }
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return IMPERIAL_REGIONS.includes(region ?? '') ? 'imperial' : 'metric'
  } catch {
    return 'imperial'
  }
}

interface UnitsStore {
  units: Units
  setUnits: (units: Units) => void
}

export const useUnitsStore = create<UnitsStore>((set) => ({
  units: getInitialUnits(),
  setUnits: (units: Units) => {
    try {
      localStorage.setItem(STORAGE_KEY, units)
    } catch {
      // ignore
    }
    set({ units })
  },
}))
