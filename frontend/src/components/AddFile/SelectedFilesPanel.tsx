import type { FileType, StatusType } from './types'
import { FileList } from './FileList'
import { ActionButtons } from './ActionButtons'
import { StatusMessage } from './StatusMessage'

interface SelectedFilesPanelProps {
  selectedType: FileType
  selectedFiles: string[]
  loading: boolean
  status: StatusType
  onGoBack: () => void
  onRemoveFile: (index: number) => void
  onUploadOnly: () => void
  onAnalyzeWithAI: () => void
}

export function SelectedFilesPanel({
  selectedType,
  selectedFiles,
  loading,
  status,
  onGoBack,
  onRemoveFile,
  onUploadOnly,
  onAnalyzeWithAI
}: SelectedFilesPanelProps) {
  if (selectedFiles.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        <button
          onClick={onGoBack}
          className="text-xs hover:text-foreground"
        >
          ← Back to file types
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={onGoBack}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <span className="text-xs text-muted-foreground">
          {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
        </span>
      </div>

      {/* File list */}
      <FileList files={selectedFiles} onRemove={onRemoveFile} />

      {/* Action buttons */}
      <ActionButtons
        loading={loading}
        selectedType={selectedType}
        onUploadOnly={onUploadOnly}
        onAnalyzeWithAI={onAnalyzeWithAI}
      />

      {/* Status message */}
      <StatusMessage status={status} />
    </div>
  )
}
