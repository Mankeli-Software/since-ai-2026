import { Button } from '@/components/ui/button'
import { useSession } from '@/store/session'

// Simple scaffold chat. #38 replaces the internals, #39 the Gen-UI renderer.
export function ChatColumn() {
  const { messages, ui, busy, error, respond } = useSession()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m) => (
        <p key={m.id} className={m.role === 'user' ? 'self-end bg-secondary px-3 py-1' : 'whitespace-pre-line'}>
          {m.text}
        </p>
      ))}
      {ui.map((u) =>
        u.block.type === 'choice_chips' ? (
          <div key={u.id} className="flex flex-wrap gap-2">
            <p className="w-full font-semibold">{u.block.prompt}</p>
            {u.block.options.map((o) => (
              <Button key={o.id} variant="secondary" disabled={u.answered || busy} onClick={() => void respond(u.id, o.id, o.label)}>
                {o.label}
              </Button>
            ))}
          </div>
        ) : (
          <pre key={u.id} className="overflow-x-auto bg-muted p-2 text-xs">
            {JSON.stringify(u.block, null, 1)}
          </pre>
        ),
      )}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  )
}
