import type { CameraPreset, CameraPresetName } from './types'

export const SHAFT_LEN = 0.8763 // m, 37 in stock shaft part
export const GRIP_LEN = 0.265
export const IN = 0.0254

// HoselSocket of 201t-mkii from manifest.json (PlaceholderHead uses the same transform).
export const SOCKET_POS: [number, number, number] = [0.05232, 0.05633, 0.00246]
export const SOCKET_QUAT: [number, number, number, number] = [0, 0, -0.23769, 0.97134]

export const GRIP_SCALE = { standard: 1, midsize: 1.04, oversize: 1.08 } as const

export const FALLBACK_PRESETS: Record<CameraPresetName, CameraPreset> = {
  headFace: { position: [0.01, 0.045, 0.24], target: [0.005, 0.026, 0] },
  addressDTL: { position: [0.04, 0.14, -0.42], target: [0.01, 0.035, 0.02] },
  shaft: { position: [0.3265, 0.4894, 0.62], target: [0.24654, 0.42942, 0.00246] },
  grip: { position: [0.4369, 0.7583, 0.34], target: [0.39692, 0.7183, 0.00246] },
  clubRow: { position: [0, 0.16, -0.58], target: [0, 0.03, 0] },
}
