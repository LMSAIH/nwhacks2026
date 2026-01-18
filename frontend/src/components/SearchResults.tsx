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

// Similarity badge color based on score
function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (similarity >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  if (similarity >= 0.4) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
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
          {result.matchedKeywords.slice(0, 5).map((kw, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${getSimilarityColor(kw.similarity)}`}
            >
              <Tag className="h-2.5 w-2.5" />
              {kw.keyword}
              <span className="opacity-70">({(kw.similarity * 100).toFixed(0)}%)</span>
            </span>
          ))}
          {result.matchedKeywords.length > 5 && (
            <span className="text-xs text-muted-foreground px-2">
              +{result.matchedKeywords.length - 5} more
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
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {result.summary.slice(0, 200)}...
          </p>
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
    <div className="bg-card border border-border rounded p-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Clock className="h-3 w-3" />
        {frame.timestamp !== undefined ? formatTimestamp(frame.timestamp) : `Frame ${frame.frame_index}`}
      </div>
      <div className="flex flex-wrap gap-1">
        {frame.keywords.slice(0, 3).map((kw, idx) => (
          <span
            key={idx}
            className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded"
          >
            {kw}
          </span>
        ))}
        {frame.keywords.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{frame.keywords.length - 3}</span>
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
