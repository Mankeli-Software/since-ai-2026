import { create } from 'zustand'

export type Units = 'imperial' | 'metric'

const STORAGE_KEY = 'takomo_units'

function getInitialUnits(): Units {
  if (typeof window === 'undefined') return 'imperial'
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === 'imperial' || val === 'metric') return val
  } catch {
    // ignore
  }
  return 'imperial'
}

interface UnitsStore {
  units: Units
  setUnits: (units: Units) => void
  toggleUnits: () => void
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
  toggleUnits: () => {
    set((state) => {
      const next: Units = state.units === 'imperial' ? 'metric' : 'imperial'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return { units: next }
    })
  },
}))
