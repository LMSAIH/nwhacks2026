import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Video,
  Music,
  Image,
  FileText,
  Sparkles,
  X,
  Play,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SemanticSearchResult, MatchedFrame, FileRecord } from '@/lib/api'
import { api } from '@/lib/api'

interface SearchPanelProps {
  results: SemanticSearchResult[]
  query: string
  loading?: boolean
  isOpen: boolean
  onClose: () => void
  onFileOpen?: (file: FileRecord, timestamp?: number) => void
}

// Format seconds to MM:SS
function formatTimestamp(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Get file type icon
function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'video':
      return <Video className={className} />
    case 'audio':
      return <Music className={className} />
    case 'image':
      return <Image className={className} />
    case 'document':
    case 'text':
      return <FileText className={className} />
    default:
      return <FileText className={className} />
  }
}

// Similarity badge color based on score - using more visible colors
function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.8) return 'bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/50 font-medium'
  if (similarity >= 0.6) return 'bg-blue-500/30 text-blue-600 dark:text-blue-400 border-blue-500/50 font-medium'
  if (similarity >= 0.4) return 'bg-amber-500/30 text-amber-600 dark:text-amber-400 border-amber-500/50 font-medium'
  return 'bg-rose-500/30 text-rose-600 dark:text-rose-400 border-rose-500/50 font-medium'
}

// Single timestamp result item (for video/audio)
function TimestampResult({ 
  result, 
  frame,
  onClick 
}: { 
  result: SemanticSearchResult
  frame?: MatchedFrame
  onClick: () => void
}) {
  const timestamp = frame?.timestamp
  const keywords = frame?.keywords || result.matchedKeywords.map(k => k.keyword)
  const topSimilarity = result.matchedKeywords[0]?.similarity || 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Play icon with timestamp */}
        <div className="flex-shrink-0 w-16 h-10 bg-secondary rounded-md flex items-center justify-center relative overflow-hidden group-hover:bg-primary/20 transition-colors">
          <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          {timestamp !== undefined && (
            <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/70 text-white px-1 rounded">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileTypeIcon type={result.filetype} className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{result.filename}</span>
          </div>
          
          {/* Matched keywords */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {keywords.slice(0, 3).map((kw, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 rounded-md font-medium"
              >
                {typeof kw === 'string' ? kw : kw}
              </span>
            ))}
            {keywords.length > 3 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+{keywords.length - 3}</span>
            )}
          </div>

          {/* Similarity */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSimilarityColor(topSimilarity)}`}>
              {(topSimilarity * 100).toFixed(0)}% match
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </button>
  )
}

// Document/Text/Image result item
function DocumentResult({ 
  result, 
  onClick 
}: { 
  result: SemanticSearchResult
  onClick: () => void
}) {
  const keywords = result.matchedKeywords.map(k => k.keyword)
  const topSimilarity = result.matchedKeywords[0]?.similarity || 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* File type icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-secondary rounded-md flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <FileTypeIcon type={result.filetype} className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{result.filename}</span>
          </div>
          
          {/* Summary preview for documents */}
          {(result.filetype === 'document' || result.filetype === 'text') && result.summary && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
              {result.summary.slice(0, 100)}{result.summary.length > 100 ? '...' : ''}
            </p>
          )}
          
          {/* Matched keywords */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {keywords.slice(0, 4).map((kw, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 bg-violet-500/25 text-violet-600 dark:text-violet-400 rounded-md font-medium"
              >
                {kw}
              </span>
            ))}
            {keywords.length > 4 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+{keywords.length - 4}</span>
            )}
          </div>

          {/* Similarity and metadata */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSimilarityColor(topSimilarity)}`}>
              {(topSimilarity * 100).toFixed(0)}% match
            </span>
            {result.wordCount && (
              <span className="text-[10px] text-muted-foreground">
                {result.wordCount} words
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </button>
  )
}

export function SearchPanel({ results, query, loading, isOpen, onClose, onFileOpen }: SearchPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Animation on open/close
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // Handle clicking a result
  const handleResultClick = useCallback(async (result: SemanticSearchResult, timestamp?: number) => {
    try {
      // Fetch the full file record
      const response = await api.getFile(result.file_id)
      if (response.success && response.file) {
        onFileOpen?.(response.file, timestamp)
      }
    } catch (error) {
      console.error('Failed to fetch file:', error)
    }
  }, [onFileOpen])

  // Separate media (video/audio) from other types (document, text, image)
  const mediaResults = results.filter(r => r.filetype === 'video' || r.filetype === 'audio')
  const otherResults = results.filter(r => r.filetype !== 'video' && r.filetype !== 'audio')

  // Flatten media results with timestamps for videos
  const timestampedResults: Array<{ result: SemanticSearchResult; frame?: MatchedFrame }> = []
  
  mediaResults.forEach(result => {
    if (result.filetype === 'video' && result.matchedFrames && result.matchedFrames.length > 0) {
      // Add each frame as a separate result
      result.matchedFrames.forEach(frame => {
        timestampedResults.push({ result, frame })
      })
    } else {
      // For audio or videos without frame data, add as single result
      timestampedResults.push({ result })
    }
  })

  // Sort by similarity (best matches first)
  timestampedResults.sort((a, b) => {
    const simA = a.result.matchedKeywords[0]?.similarity || 0
    const simB = b.result.matchedKeywords[0]?.similarity || 0
    return simB - simA
  })

  // Sort other results by similarity too
  const sortedOtherResults = [...otherResults].sort((a, b) => {
    const simA = a.matchedKeywords[0]?.similarity || 0
    const simB = b.matchedKeywords[0]?.similarity || 0
    return simB - simA
  })

  const totalResults = timestampedResults.length + sortedOtherResults.length

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className={`w-96 h-full bg-background border-l border-border flex flex-col transition-all duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground text-sm">Search Results</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              "{query}"
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-xs text-muted-foreground">Searching...</p>
          </div>
        ) : totalResults === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Sparkles className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try different keywords or process more files with AI
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </p>

            {/* Documents, Text, Images Section */}
            {sortedOtherResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Documents & Images ({sortedOtherResults.length})</span>
                </div>
                {sortedOtherResults.map((result) => (
                  <DocumentResult
                    key={result.file_id}
                    result={result}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>
            )}

            {/* Media with Timestamps Section */}
            {timestampedResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Video className="h-3.5 w-3.5" />
                  <span>Media Timestamps ({timestampedResults.length})</span>
                </div>
                {timestampedResults.map((item, idx) => (
                  <TimestampResult
                    key={`${item.result.file_id}-${item.frame?.frame_index || 0}-${idx}`}
                    result={item.result}
                    frame={item.frame}
                    onClick={() => handleResultClick(item.result, item.frame?.timestamp)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
