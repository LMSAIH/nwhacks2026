import { X } from 'lucide-react'
import { isElectron } from './types'

interface FileListProps {
  files: string[]
  onRemove: (index: number) => void
}

export function FileList({ files, onRemove }: FileListProps) {
  return (
    <div className="max-h-32 overflow-y-auto space-y-1">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-2 py-1 bg-secondary/50 rounded text-xs"
        >
          <span className="truncate flex-1">
            {isElectron() ? file.split(/[/\\]/).pop() : file}
          </span>
          <button
            onClick={() => onRemove(index)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
