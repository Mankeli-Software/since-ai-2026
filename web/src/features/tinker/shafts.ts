import type { Flex, HeadSlug, Material } from './types'

export interface ShaftInfo {
  slug: string
  model: string
  manufacturer: string
  material: Material
  flex: Flex
  weightG: number
  heads: HeadSlug[]
}

export const SHAFTS: ShaftInfo[] = [
  // MKII Steel
  { slug: 'kbs-tour-regular', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'regular', weightG: 120, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'kbs-tour-stiff', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'stiff', weightG: 130, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'kbs-tour-x-stiff', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'x-stiff', weightG: 133, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'kbs-tour-lite-regular', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'regular', weightG: 105, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'kbs-tour-lite-stiff', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'stiff', weightG: 105, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'kbs-tour-lite-x-stiff', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'x-stiff', weightG: 110, heads: ['101-mkii', '201-mkii', '201t-mkii'] },

  // MKII Graphite
  { slug: 'mitsubishi-mmt-50-l', model: 'Mitsubishi MMT', manufacturer: 'Mitsubishi', material: 'graphite', flex: 'lady', weightG: 54, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'mitsubishi-mmt-60-a', model: 'Mitsubishi MMT', manufacturer: 'Mitsubishi', material: 'graphite', flex: 'senior', weightG: 62, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'mitsubishi-mmt-70-r', model: 'Mitsubishi MMT', manufacturer: 'Mitsubishi', material: 'graphite', flex: 'regular', weightG: 73, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'mitsubishi-mmt-80-s', model: 'Mitsubishi MMT', manufacturer: 'Mitsubishi', material: 'graphite', flex: 'stiff', weightG: 84, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'true-temper-denali-silver-40g-4-0', model: 'True Temper Denali Silver', manufacturer: 'True Temper', material: 'graphite', flex: 'lady', weightG: 53, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'true-temper-denali-silver-50g-5-0', model: 'True Temper Denali Silver', manufacturer: 'True Temper', material: 'graphite', flex: 'senior', weightG: 58, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'true-temper-denali-silver-60g-5-5', model: 'True Temper Denali Silver', manufacturer: 'True Temper', material: 'graphite', flex: 'regular', weightG: 77, heads: ['101-mkii', '201-mkii', '201t-mkii'] },
  { slug: 'true-temper-denali-silver-70g-6-0', model: 'True Temper Denali Silver', manufacturer: 'True Temper', material: 'graphite', flex: 'stiff', weightG: 89, heads: ['101-mkii', '201-mkii', '201t-mkii'] },

  // 301 Steel
  { slug: 'kbs-tour-regular-301', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'regular', weightG: 120, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-tour-stiff-301', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'stiff', weightG: 130, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-tour-x-stiff-301', model: 'KBS Tour', manufacturer: 'KBS', material: 'steel', flex: 'x-stiff', weightG: 133, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-tour-lite-regular-301', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'regular', weightG: 105, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-tour-lite-stiff-301', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'stiff', weightG: 105, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-tour-lite-x-stiff-301', model: 'KBS Tour Lite', manufacturer: 'KBS', material: 'steel', flex: 'x-stiff', weightG: 110, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-c-taper-regular', model: 'KBS C-Taper', manufacturer: 'KBS', material: 'steel', flex: 'regular', weightG: 125, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-c-taper-stiff', model: 'KBS C-Taper', manufacturer: 'KBS', material: 'steel', flex: 'stiff', weightG: 130, heads: ['301-cb', '301-mb'] },
  { slug: 'kbs-c-taper-x-stiff', model: 'KBS C-Taper', manufacturer: 'KBS', material: 'steel', flex: 'x-stiff', weightG: 135, heads: ['301-cb', '301-mb'] },

  // 301 Graphite
  { slug: 'obsidian-75-a', model: 'Takomo Obsidian', manufacturer: 'Takomo', material: 'graphite', flex: 'senior', weightG: 72, heads: ['301-cb', '301-mb'] },
  { slug: 'obsidian-75-r', model: 'Takomo Obsidian', manufacturer: 'Takomo', material: 'graphite', flex: 'regular', weightG: 75, heads: ['301-cb', '301-mb'] },
  { slug: 'obsidian-95-s', model: 'Takomo Obsidian', manufacturer: 'Takomo', material: 'graphite', flex: 'stiff', weightG: 98, heads: ['301-cb', '301-mb'] },
  { slug: 'obsidian-115-x', model: 'Takomo Obsidian', manufacturer: 'Takomo', material: 'graphite', flex: 'x-stiff', weightG: 111, heads: ['301-cb', '301-mb'] },
  { slug: 'fujikura-atmos-red-a', model: 'Fujikura Atmos Red', manufacturer: 'Fujikura', material: 'graphite', flex: 'senior', weightG: 72, heads: ['301-cb', '301-mb'] },
  { slug: 'fujikura-atmos-red-r', model: 'Fujikura Atmos Red', manufacturer: 'Fujikura', material: 'graphite', flex: 'regular', weightG: 72, heads: ['301-cb', '301-mb'] },
  { slug: 'fujikura-atmos-red-s', model: 'Fujikura Atmos Red', manufacturer: 'Fujikura', material: 'graphite', flex: 'stiff', weightG: 72, heads: ['301-cb', '301-mb'] },
]

export function is301Head(head: HeadSlug): boolean {
  return head === '301-cb' || head === '301-mb'
}

export function pickShaftForSpec(head: HeadSlug, material: Material, flex: Flex, currentShaftSlug?: string): string {
  const eligible = SHAFTS.filter((s) => s.heads.includes(head) && s.material === material)
  if (eligible.length === 0) {
    // If no eligible shaft exists for this material, try opposite material
    const fallbackMat = material === 'steel' ? 'graphite' : 'steel'
    return pickShaftForSpec(head, fallbackMat, flex, currentShaftSlug)
  }

  // Exact flex match
  const withFlex = eligible.filter((s) => s.flex === flex)
  if (withFlex.length > 0) {
    if (currentShaftSlug) {
      const current = SHAFTS.find((s) => s.slug === currentShaftSlug)
      if (current) {
        // Try same model name
        const sameModel = withFlex.find((s) => s.model === current.model)
        if (sameModel) return sameModel.slug
      }
    }
    return withFlex[0].slug
  }

  // Nearest flex fallback
  return eligible[0].slug
}
