import { SimulatorMapView } from '../../result/SimulatorMap'
import type { BlockProps } from '../types'

export const type = 'simulator_map'

export function Component({ block }: BlockProps<'simulator_map'>) {
  return <SimulatorMapView ids={block.simulator_ids} />
}
