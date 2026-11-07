import { useEffect, useRef, useState } from 'react'
import { btnCls } from '@/features/genui/ui'
import { arPageUrl, headLabel } from './heads'

type QrFactory = (type: number, level: string) => { addData(s: string): void; make(): void; createSvgTag(o: { cellSize: number; margin: number; scalable: boolean }): string }
const QR_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'

/** Loads the pinned QR library once; the URL is encoded in the browser, never sent to a QR service. */
function loadQr(): Promise<QrFactory> {
  const w = window as unknown as { qrcode?: QrFactory }
  if (w.qrcode) return Promise.resolve(w.qrcode)
  return new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = QR_SRC
    s.onload = () => (w.qrcode ? ok(w.qrcode) : fail(new Error('qr')))
    s.onerror = () => fail(new Error('qr'))
    document.head.appendChild(s)
  })
}

/** "See it in AR" button + QR modal. The phone opens ar.html top-level (never in an iframe). */
export function ArQrButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const url = arPageUrl(slug)

  useEffect(() => {
    if (!open) return
    loadQr()
      .then((qr) => {
        const q = qr(0, 'M')
        q.addData(url)
        q.make()
        if (box.current) box.current.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })
      })
      .catch(() => setFailed(true))
  }, [open, url])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnCls} rounded-md border border-ink-900 bg-card text-foreground hover:bg-ink-100`}>
        View at Address (AR)
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Scan to view at address in AR" onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="flex w-80 flex-col items-center gap-3 rounded-lg bg-card p-6 text-center">
            <h2 className="font-display text-2xl font-semibold uppercase">{headLabel(slug)} at Address</h2>
            <p className="text-sm text-ink-500">Aim your phone camera at the carpet to inspect the topline, offset, and look at address.</p>
            <div ref={box} className="h-56 w-56" />
            {failed && <p className="text-sm text-orange-ink">QR glitch. Open this link on your phone instead:</p>}
            <a href={url} target="_blank" rel="noreferrer" className="break-all text-xs text-ink-500 underline">{url}</a>
            <button type="button" onClick={() => setOpen(false)} className={`${btnCls} rounded-md bg-ink-900 text-washed-white`}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
