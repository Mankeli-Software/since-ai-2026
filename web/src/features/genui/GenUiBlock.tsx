import { blockFor } from './registry'
import type { BlockProps } from './types'

/** Renders one gen-UI block from the registry. Unknown types show a small placeholder, never raw HTML. */
export function GenUiBlock(props: BlockProps) {
  const mod = blockFor(props.block.type)
  if (!mod) return <UnknownBlock type={props.block.type} />
  const { Component } = mod
  return <Component {...props} />
}

export function UnknownBlock({ type }: { type: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
      This part of the studio is not ready yet ({type}).
    </div>
  )
}
