import { Component, type ReactNode } from 'react'

/** A WebGL failure must never take the chat down with it. */
export class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <p className="p-4">The 3D stage is not available in this browser.</p> : this.props.children
  }
}
