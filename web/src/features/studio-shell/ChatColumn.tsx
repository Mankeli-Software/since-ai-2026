import { useSession } from '@/store/session'
import { ChatPanel } from '../chat/ChatPanel'
import { FormFallback } from '../form/FormFallback'

export function ChatColumn() {
  const mode = useSession((s) => s.mode)
  return mode === 'form' ? <FormFallback /> : <ChatPanel />
}
