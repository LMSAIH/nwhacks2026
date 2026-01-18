import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X,
  Tag,
  FileText,
  HardDrive,
  ExternalLink,
  BookOpen,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Hash,
  Type
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { api } from '@/lib/api'

interface DocumentDetailPanelProps {
  file: FileRecord
  onClose: () => void
}

export function DocumentDetailPanel({ file, onClose }: DocumentDetailPanelProps) {
  const [content, setContent] = useState<string>('')
  const [summary, setSummary] = useState<string>('')
  const [wordCount, setWordCount] = useState<number>(0)
  const [characterCount, setCharacterCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [showFullContent, setShowFullContent] = useState(false)

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      try {
        const result = await api.getDocumentContent(file.id)
        if (result.success) {
          setContent(result.content)
          setSummary(result.summary)
          setWordCount(result.wordCount)
          setCharacterCount(result.characterCount)
        }
      } catch (error) {
        console.error('Failed to fetch document content:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [file.id])

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const getExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE'
  }

  const getExtensionColor = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'txt': return 'bg-gray-500/20 text-gray-600'
      case 'md': return 'bg-purple-500/20 text-purple-600'
      default: return 'bg-secondary text-muted-foreground'
    }
  }

  const openInSystemViewer = () => {
    if (window.electronAPI) {
      console.log('Open file:', file.filepath)
    }
  }

  const contentPreview = content.length > 500 ? content.slice(0, 500) + '...' : content

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-orange-500" />
          <h2 className="font-semibold truncate">{file.filename}</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Document Preview */}
        <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 rounded-lg p-8 flex flex-col items-center justify-center gap-4">
          <FileText className="h-20 w-20 text-muted-foreground" />
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getExtensionColor(file.filename)}`}>
            {getExtension(file.filename)}
          </span>
          <Button variant="outline" className="gap-2" onClick={openInSystemViewer}>
            <ExternalLink className="h-4 w-4" />
            Open in System Viewer
          </Button>
        </div>

        {/* AI Summary */}
        {summary && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              AI Summary
            </h3>
            <div className="p-3 bg-yellow-500/10 rounded-lg text-sm leading-relaxed">
              {summary}
            </div>
          </div>
        )}

        {/* Document Content */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Content Preview
          </h3>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div className="space-y-2">
              <div className="p-3 bg-muted/50 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {showFullContent ? content : contentPreview}
              </div>
              {content.length > 500 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => setShowFullContent(!showFullContent)}
                >
                  {showFullContent ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show Full Content
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              No content available. Analyze this document to extract content.
            </div>
          )}
        </div>

        {/* File Stats */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            File Information
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Size</div>
            <div>{formatSize(file.size)}</div>
            <div className="text-muted-foreground">Type</div>
            <div>{file.mimetype || getExtension(file.filename)}</div>
            <div className="text-muted-foreground">Added</div>
            <div>{file.created_at ? new Date(file.created_at).toLocaleString() : 'Unknown'}</div>
            {wordCount > 0 && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  Words
                </div>
                <div>{wordCount.toLocaleString()}</div>
              </>
            )}
            {characterCount > 0 && (
              <>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Characters
                </div>
                <div>{characterCount.toLocaleString()}</div>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            {file.filepath}
          </div>
        </div>

        {/* Keywords */}
        {file.keywords && file.keywords.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              AI Keywords ({file.keywords.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {file.keywords.map((keyword, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-orange-500/10 text-orange-700 dark:text-orange-300 rounded-md text-xs"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {file.tags && file.tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {file.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
