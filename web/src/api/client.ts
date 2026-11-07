import createClient from 'openapi-fetch'
import type { components, paths } from './schema.gen'

/** Same-origin: Vite proxies /api in dev, FastAPI serves both in prod. */
export const api = createClient<paths>({ baseUrl: '' })

type Schemas = components['schemas']
export type FittingState = Schemas['FittingState']
export type UIBlock = Schemas['UiEvent']['block']
export type TurnRequest = Schemas['TurnRequest']
export type StreamEvent =
  | Schemas['TurnStartEvent']
  | Schemas['TextEvent']
  | Schemas['UiEvent']
  | Schemas['StageEvent']
  | Schemas['StateEvent']
  | Schemas['MascotEvent']
  | Schemas['DoneEvent']
  | Schemas['ErrorEvent']
