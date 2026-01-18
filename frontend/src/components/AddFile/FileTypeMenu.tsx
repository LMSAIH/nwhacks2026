import { ChevronRight } from 'lucide-react'
import type { FileType } from './types'
import { fileTypeConfig } from './types'

interface FileTypeMenuProps {
  onSelectType: (type: FileType) => void
}

export function FileTypeMenu({ onSelectType }: FileTypeMenuProps) {
  return (
    <>
      <p className="text-xs text-muted-foreground px-2 py-1 mb-1">Select file type</p>
      {(Object.keys(fileTypeConfig) as FileType[]).map((type) => {
        const config = fileTypeConfig[type]
        const Icon = config.icon
        return (
          <button
            key={type}
            onClick={() => onSelectType(type)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary text-left text-sm transition-colors"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{config.label}</span>
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </button>
        )
      })}
    </>
  )
}
