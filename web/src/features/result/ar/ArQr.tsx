import { useEffect, useRef, useState } from 'react'
import { loadQr } from '@/features/ar/ArQrButton'

export function ArQr({ url, className }: { url: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadQr()
      .then((qr) => {
        if (!active) return
        const q = qr(0, 'M')
        q.addData(url)
        q.make()
        if (box.current) {
          box.current.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })
          const svg = box.current.querySelector('svg')
          if (svg) {
            svg.setAttribute('class', 'w-full h-full block')
          }
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [url])

  if (failed) {
    return (
      <div className={`${className ?? ''} flex items-center justify-center p-2 text-center text-xs text-grey-8f`}>
        QR could not load. Open the link instead.
      </div>
    )
  }

  return <div ref={box} className={className} />
}
