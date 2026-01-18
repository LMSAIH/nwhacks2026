import type { StatusType } from './types'

interface StatusMessageProps {
  status: StatusType
}

export function StatusMessage({ status }: StatusMessageProps) {
  if (!status) return null

  const colorClass = 
    status.type === 'success'
      ? 'bg-green-500/10 text-green-600'
      : status.type === 'error'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-secondary text-muted-foreground'

  return (
    <div className={`px-3 py-2 rounded text-xs ${colorClass}`}>
      {status.message}
    </div>
  )
}
