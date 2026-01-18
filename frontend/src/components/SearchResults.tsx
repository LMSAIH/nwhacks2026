import { useState } from 'react'
import {
  Video,
  Music,
  Image,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Film,
  Tag,
  Loader2
} from 'lucide-react'
import type { SemanticSearchResult, MatchedFrame } from '@/lib/api'

interface SearchResultsProps {
  results: SemanticSearchResult[]
  query: string
  loading?: boolean
  onFileSelect?: (fileId: number) => void
}

// Format seconds to MM:SS
function formatTimestamp(seconds?: number): string {
  if (seconds === undefined || seconds === null) return ''
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

// Single search result card
function SearchResultCard({ 
  result, 
  onSelect 
}: { 
  result: SemanticSearchResult
  onSelect?: (fileId: number) => void 
}) {
  const [expanded, setExpanded] = useState(false)
  const hasFrames = result.matchedFrames && result.matchedFrames.length > 0
  const topSimilarity = result.matchedKeywords[0]?.similarity || 0

  return (
    <div 
      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => onSelect?.(result.file_id)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* File Type Icon */}
          <div className="p-2 bg-secondary rounded-lg">
            <FileTypeIcon type={result.filetype} className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{result.filename}</h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{result.filepath}</p>
            
            {/* Top Match Similarity */}
            <div className="flex items-center gap-2 mt-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Best match:</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${getSimilarityColor(topSimilarity)}`}>
                {(topSimilarity * 100).toFixed(0)}% similar
              </span>
            </div>
          </div>

          {/* Expand button for videos with frames */}
          {hasFrames && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>

        {/* Matched Keywords */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.matchedKeywords.slice(0, 6).map((kw, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border shadow-sm ${getSimilarityColor(kw.similarity)}`}
            >
              <Tag className="h-3 w-3" />
              <span className="font-medium">{kw.keyword}</span>
              <span className="text-[10px] opacity-80">({(kw.similarity * 100).toFixed(0)}%)</span>
            </span>
          ))}
          {result.matchedKeywords.length > 6 && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
              +{result.matchedKeywords.length - 6} more
            </span>
          )}
        </div>

        {/* Type-specific info */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {result.filetype === 'audio' && result.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimestamp(result.duration)}
            </span>
          )}
          {result.filetype === 'audio' && result.language && (
            <span>Language: {result.language}</span>
          )}
          {(result.filetype === 'document' || result.filetype === 'text') && result.wordCount && (
            <span>{result.wordCount} words</span>
          )}
          {result.created_at && (
            <span>{new Date(result.created_at).toLocaleDateString()}</span>
          )}
        </div>

        {/* Audio transcription preview */}
        {result.filetype === 'audio' && result.transcription && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
            "{result.transcription.slice(0, 150)}..."
          </p>
        )}

        {/* Document summary preview */}
        {(result.filetype === 'document' || result.filetype === 'text') && result.summary && (
          <div className="mt-3 p-2.5 bg-muted/50 rounded-md border border-border/50">
            <p className="text-xs text-foreground/80 line-clamp-3">
              {result.summary.slice(0, 300)}{result.summary.length > 300 ? '...' : ''}
            </p>
          </div>
        )}

        {/* Document/Text keywords display */}
        {(result.filetype === 'document' || result.filetype === 'text') && result.matchedKeywords.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Found in:</span>
            <div className="flex flex-wrap gap-1">
              {result.matchedKeywords.slice(0, 4).map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-md font-medium"
                >
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expanded: Matched Frames (for videos) */}
      {expanded && hasFrames && (
        <div className="border-t border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Matched Frames ({result.matchedFrames!.length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {result.matchedFrames!.slice(0, 8).map((frame, idx) => (
              <FrameCard key={idx} frame={frame} />
            ))}
          </div>
          {result.matchedFrames!.length > 8 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              +{result.matchedFrames!.length - 8} more frames
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Frame card for video matches
function FrameCard({ frame }: { frame: MatchedFrame }) {
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium mb-1.5">
        <Clock className="h-3.5 w-3.5 text-primary" />
        {frame.timestamp !== undefined ? formatTimestamp(frame.timestamp) : `Frame ${frame.frame_index}`}
      </div>
      <div className="flex flex-wrap gap-1">
        {frame.keywords.slice(0, 3).map((kw, idx) => (
          <span
            key={idx}
            className="text-[10px] px-2 py-0.5 bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 rounded-md font-medium"
          >
            {kw}
          </span>
        ))}
        {frame.keywords.length > 3 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+{frame.keywords.length - 3}</span>
        )}
      </div>
    </div>
  )
}

// Main SearchResults component
export function SearchResults({ results, query, loading, onFileSelect }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Searching with AI...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Sparkles className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-muted-foreground">No semantic matches found for "{query}"</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try different keywords or process more files with AI first
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <SearchResultCard
          key={result.file_id}
          result={result}
          onSelect={onFileSelect}
        />
      ))}
    </div>
  )
}

// Export types
export type { SemanticSearchResult }
