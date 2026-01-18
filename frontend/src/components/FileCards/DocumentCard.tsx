import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Trash2, 
  FileText,
  FileType
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { api } from '@/lib/api'

interface DocumentCardProps {
  file: FileRecord
  onDelete: (id: number) => void
  onSelect: (file: FileRecord) => void
}

export function DocumentCard({ file, onDelete, onSelect }: DocumentCardProps) {
  const [contentPreview, setContentPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch document content preview on mount
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const result = await api.getDocumentContent(file.id)
        if (result.success && result.content) {
          // Get first ~500 characters for preview
          setContentPreview(result.content.slice(0, 500))
        }
      } catch (error) {
        console.error('Failed to fetch document content:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchContent()
  }, [file.id])

  const getExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || 'file'
  }

  const getFileTypeLabel = (filename: string) => {
    const ext = getExtension(filename)
    switch (ext) {
      case 'txt': return 'Plain Text'
      case 'md': return 'Markdown'
      default: return 'Document'
    }
  }

  const getFileTypeIcon = (filename: string) => {
    const ext = getExtension(filename)
    switch (ext) {
      case 'md': return <FileType className="h-3.5 w-3.5" />
      default: return <FileText className="h-3.5 w-3.5" />
    }
  }

  return (
    <Card 
      className="group overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 hover:shadow-lg transition-all duration-200 bg-[#fefefe] dark:bg-[#1a1a1a] h-full flex flex-col"
      onClick={() => onSelect(file)}
    >
      {/* Header - Title and File Type */}
      <div className="px-4 pt-4 pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* File Type Badge */}
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              {getFileTypeIcon(file.filename)}
              <span>{getFileTypeLabel(file.filename)}</span>
            </div>
            
            {/* Title */}
            <h3 
              className="font-semibold text-sm text-foreground truncate leading-tight"
              style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
              title={file.filename}
            >
              {file.filename.replace(/\.[^/.]+$/, '')}
            </h3>
          </div>

          {/* Delete Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(file.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content Preview Area - fills remaining space */}
      <div className="px-4 py-3 flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-11/12" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-4/5" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        ) : contentPreview ? (
          <p 
            className="text-[11px] leading-[1.7] text-muted-foreground whitespace-pre-wrap break-words"
            style={{ 
              fontFamily: "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
              letterSpacing: '-0.01em'
            }}
          >
            {contentPreview}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
            <FileText className="h-8 w-8 mb-2" />
            <span className="text-xs">No preview available</span>
          </div>
        )}

        {/* Fade out gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#fefefe] dark:from-[#1a1a1a] to-transparent pointer-events-none" />
      </div>

      {/* Footer - Subtle metadata */}
      <div className="px-4 py-2 border-t border-border/30 bg-muted/20">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span style={{ fontFamily: "'Inter', sans-serif" }}>
            .{getExtension(file.filename)}
          </span>
          {file.metadata?.word_count && (
            <span>{file.metadata.word_count} words</span>
          )}
        </div>
      </div>
    </Card>
  )
}
