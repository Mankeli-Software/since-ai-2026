import { Component, type ReactNode } from 'react'

/** A WebGL failure must never take the chat down with it. `fallback` replaces the default message. */
export class StageBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return this.props.fallback ?? <p className="p-4">The 3D stage is not available in this browser.</p>
  }
}
