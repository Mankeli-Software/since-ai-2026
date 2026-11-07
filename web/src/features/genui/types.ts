import type { ComponentType } from 'react'
import type { UIBlock } from '@/api/client'

export type BlockType = UIBlock['type']
export type BlockOf<T extends BlockType> = Extract<UIBlock, { type: T }>

/** What the golfer sent back for an input block. Shown when the block is read-only. */
export interface BlockAnswer {
  value: unknown
  displayText: string
}

export interface BlockProps<T extends BlockType = BlockType> {
  /** Component id from the `ui` event; a ui_response echoes it as `component_id`. */
  id: string
  block: BlockOf<T>
  /** True only for an input block that still waits for the golfer. */
  interactive: boolean
  /** Set once the golfer answered: render read-only with this value. */
  answer?: BlockAnswer
  /** A turn is streaming: disable buttons. */
  busy: boolean
  /** Sends `{kind: "ui_response", component_id: id, value, display_text}` and resumes the turn. */
  respond: (value: unknown, displayText: string) => void
}

/** The contract of every `blocks/<type>.tsx` file: `export const type = '<type>'` and `export function Component`. */
export interface BlockModule<T extends BlockType = BlockType> {
  type: T
  Component: ComponentType<BlockProps<T>>
}
