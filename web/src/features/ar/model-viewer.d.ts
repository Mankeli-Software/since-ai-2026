import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        'ios-src'?: string
        'ar'?: boolean
        'ar-modes'?: string
        'camera-controls'?: boolean
        'shadow-intensity'?: string
        alt?: string
      }
    }
  }
}
