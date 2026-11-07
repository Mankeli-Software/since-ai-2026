import { StudioHeader } from '../studio-shell/StudioHeader'

/**
 * v3 results phase (spec §2.2). STUB owned by task T2: header + placeholder body.
 * T1 renders it from Studio.tsx once the fit is in (see isResultPhase).
 */
export default function ResultsShell() {
  return (
    <div className="bg-bay flex h-screen flex-col">
      <StudioHeader variant="results" />
      <main className="flex flex-1 items-center justify-center text-grey-a3">Results shell coming (T2)</main>
    </div>
  )
}
