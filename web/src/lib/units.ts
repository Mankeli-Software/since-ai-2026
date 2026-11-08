import type { Units } from '@/store/units'

export const YARDS_TO_METERS = 0.9144
export const MPH_TO_KMH = 1.609344
export const INCHES_TO_CM = 2.54

export type UnitKind = 'distance' | 'distance_plural' | 'speed' | 'length' | 'temp'

/** Returns the unit symbol or word for the active unit system. */
export function unitLabel(kind: UnitKind, units: Units): string {
  switch (kind) {
    case 'distance':
      return units === 'metric' ? 'm' : 'yd'
    case 'distance_plural':
      return units === 'metric' ? 'meters' : 'yards'
    case 'speed':
      return units === 'metric' ? 'km/h' : 'mph'
    case 'length':
      return units === 'metric' ? 'cm' : 'in'
    case 'temp':
      return units === 'metric' ? '°C' : '°F'
  }
}

/** Convert yard distance to numeric display value in active units. */
export function distanceValue(yd: number, units: Units, decimals = 0): number {
  const val = units === 'metric' ? yd * YARDS_TO_METERS : yd
  if (decimals === 0) return Math.round(val)
  const factor = 10 ** decimals
  return Math.round(val * factor) / factor
}

/** Format distance with unit: "150 yd" or "137 m". */
export function fmtDistance(yd: number, units: Units, decimals = 0): string {
  const val = distanceValue(yd, units, decimals)
  return `${val} ${unitLabel('distance', units)}`
}

/** Convert mph speed to numeric display value in active units. */
export function speedValue(mph: number, units: Units, decimals = 0): number {
  const val = units === 'metric' ? mph * MPH_TO_KMH : mph
  if (decimals === 0) return Math.round(val)
  const factor = 10 ** decimals
  return Math.round(val * factor) / factor
}

/** Format speed with unit: "76 mph" or "122 km/h". */
export function fmtSpeed(mph: number, units: Units, decimals = 0): string {
  const val = speedValue(mph, units, decimals)
  return `${val} ${unitLabel('speed', units)}`
}

/** Format club length delta or length: "+0.5 in" or "+1.3 cm" (or "Standard" for 0). */
export function fmtLength(inVal: number, units: Units, options?: { signed?: boolean }): string {
  const signed = options?.signed ?? true
  if (signed && inVal === 0) return 'Standard'
  const sign = inVal > 0 ? '+' : inVal < 0 ? '−' : ''
  const abs = Math.abs(inVal)
  if (units === 'metric') {
    const cm = Math.round(abs * INCHES_TO_CM * 10) / 10
    return `${sign}${cm} cm`
  }
  const factor = 10 ** 2
  const formatted = Math.round(abs * factor) / factor
  return `${sign}${formatted} in`
}

/** Format height: "181 cm" or "5′11″". */
export function fmtHeight(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`
  const totalInches = Math.round(cm / INCHES_TO_CM)
  const ft = Math.floor(totalInches / 12)
  const inc = totalInches % 12
  return `${ft}′${inc}″`
}

/** Format wrist to floor: "86 cm" or "34 in". */
export function fmtWristToFloor(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`
  return `${Math.round(cm / INCHES_TO_CM)} in`
}

/** Convert inline unit mentions in prose/labels (e.g. "160 yd carry" -> "146 m carry"). */
export function convertProseUnits(text: string, units: Units): string {
  if (!text) return text
  if (units === 'metric') {
    return text
      .replace(/(\d+(?:\.\d+)?)\s*yards\b/gi, (_, n) => `${Math.round(Number(n) * YARDS_TO_METERS)} meters`)
      .replace(/(\d+(?:\.\d+)?)\s*yd\b/gi, (_, n) => `${Math.round(Number(n) * YARDS_TO_METERS)} m`)
      .replace(/(\d+(?:\.\d+)?)\s*mph\b/gi, (_, n) => `${Math.round(Number(n) * MPH_TO_KMH)} km/h`)
  }
  return text
    .replace(/(\d+(?:\.\d+)?)\s*meters\b/gi, (_, n) => `${Math.round(Number(n) / YARDS_TO_METERS)} yards`)
    .replace(/(\d+(?:\.\d+)?)\s*m\b/gi, (_, n) => `${Math.round(Number(n) / YARDS_TO_METERS)} yd`)
    .replace(/(\d+(?:\.\d+)?)\s*km\/h\b/gi, (_, n) => `${Math.round(Number(n) / MPH_TO_KMH)} mph`)
}

// "6 ft 1 in", "6 ft 1", "6 ft", "6 feet 1 inch", 6'1" / 6′1″: one height, converted as a whole.
const FEET_INCHES =
  /(\d+)\s*(?:ft\b|feet\b|foot\b)(?:\s*(\d+(?:\.\d+)?)(?:\s*(?:inches|inch|in)\b)?)?|(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]/gi
// "N inch(es)" always; "N in" only when it reads as a length: not "85 in 18 holes", "in a round", "in my bag".
const INCHES =
  /([-+−]?\d+(?:\.\d+)?)\s*(?:inches|inch\b|in\b(?!\s+(?:\d|(?:a|an|the|my|your|his|her|their|our|this|that|each|every|one|two|three|four|five|six|seven|eight|nine|ten|last|under|over|about|total)\b)))/gi
const cm1 = (inches: number) => Math.round(inches * INCHES_TO_CM * 10) / 10

/** Convert inline body-length mentions (e.g. "17 cm" -> "6.7 in", "6 ft 1 in" -> "185 cm"). Separate from
 *  `convertProseUnits`, which the results use for distances and speeds only. */
export function convertProseLengths(text: string, units: Units): string {
  if (!text) return text
  if (units === 'imperial') {
    return text.replace(/(\d+(?:\.\d+)?)\s*cm\b/gi, (_, n) => `${Math.round((Number(n) / INCHES_TO_CM) * 10) / 10} in`)
  }
  return text
    .replace(FEET_INCHES, (_, ft, inch, ft2, inch2) => {
      const total = Number(ft ?? ft2) * 12 + Number(inch ?? inch2 ?? 0)
      return `${Math.round(total * INCHES_TO_CM)} cm`
    })
    .replace(INCHES, (_, n: string) => {
      const sign = /^[-+−]/.test(n) ? n[0] : '' // keep the sign as written ("+0.5 in" -> "+1.3 cm")
      return `${sign}${cm1(Number(sign ? n.slice(1) : n))} cm`
    })
}
