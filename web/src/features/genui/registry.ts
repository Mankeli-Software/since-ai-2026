import type { BlockModule, BlockType } from './types'

// One file per block (plan §6.4): no central map to edit. Sorted, so the order is stable.
const modules = import.meta.glob<BlockModule>('./blocks/*.tsx', { eager: true })

export const registry: ReadonlyMap<string, BlockModule> = new Map(
  Object.keys(modules)
    .sort()
    .map((path) => [modules[path].type, modules[path]] as const),
)

export const blockFor = (type: BlockType | string): BlockModule | undefined => registry.get(type)
