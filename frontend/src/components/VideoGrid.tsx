import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  Trash2, 
  Tag,
  Clock,
  FileVideo,
  Loader2,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { api } from '@/lib/api'

interface VideoCardProps {
  file: FileRecord
  onDelete: (id: number) => void
  onSelect: (file: FileRecord) => void
}

function VideoCard({ file, onDelete, onSelect }: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showKeywords, setShowKeywords] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
  }

  // Convert filepath to media:// URL for video playback
  const videoSrc = `media://${file.filepath.replace(/\\/g, '/')}`

  return (
    <Card 
      className="group overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
      onClick={() => onSelect(file)}
    >
      {/* Video Preview */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onEnded={() => setIsPlaying(false)}
          muted
        />
        
        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
          </Button>
        </div>

        {/* Delete Button */}
        <Button
          size="icon"
          variant="destructive"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(file.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Filename */}
        <h3 className="font-medium text-sm truncate" title={file.filename}>
          {file.filename}
        </h3>

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileVideo className="h-3 w-3" />
            {formatSize(file.size)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(file.created_at)}
          </span>
        </div>

        {/* Keywords Toggle */}
        {file.keywords && file.keywords.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs w-full justify-between"
              onClick={(e) => {
                e.stopPropagation()
                setShowKeywords(!showKeywords)
              }}
            >
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {file.keywords.length} keywords
              </span>
              {showKeywords ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            
            {showKeywords && (
              <div className="flex flex-wrap gap-1 mt-2">
                {file.keywords.slice(0, 10).map((keyword, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
                  >
                    {keyword}
                  </span>
                ))}
                {file.keywords.length > 10 && (
                  <span className="px-2 py-0.5 text-muted-foreground text-xs">
                    +{file.keywords.length - 10} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {file.tags && file.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {file.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface VideoGridProps {
  files: FileRecord[]
  loading?: boolean
  onRefresh: () => void
}

export function VideoGrid({ files, loading, onRefresh }: VideoGridProps) {
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null)
  const [detailedFile, setDetailedFile] = useState<FileRecord | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const handleSelect = async (file: FileRecord) => {
    setSelectedFile(file)
    setLoadingDetails(true)
    try {
      const result = await api.getFile(file.id)
      if (result.success) {
        setDetailedFile(result.file)
      }
    } catch (error) {
      console.error('Failed to load file details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return
    try {
      await api.deleteFile(id)
      onRefresh()
      if (selectedFile?.id === id) {
        setSelectedFile(null)
        setDetailedFile(null)
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const closeDetail = () => {
    setSelectedFile(null)
    setDetailedFile(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileVideo className="h-12 w-12 mb-4" />
        <p>No videos yet</p>
        <p className="text-sm">Add videos to get started</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => (
          <VideoCard
            key={file.id}
            file={file}
            onDelete={handleDelete}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Detail Sidebar */}
      {selectedFile && (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
            <h2 className="font-semibold truncate">{selectedFile.filename}</h2>
            <Button size="icon" variant="ghost" onClick={closeDetail}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Video Player */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={`media://${selectedFile.filepath.replace(/\\/g, '/')}`}
                className="w-full h-full object-contain"
                controls
              />
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : detailedFile ? (
              <>
                {/* File Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">File Info</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="text-foreground">Path:</span> {detailedFile.filepath}</p>
                    <p><span className="text-foreground">Size:</span> {detailedFile.size ? `${(detailedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'}</p>
                    <p><span className="text-foreground">Type:</span> {detailedFile.mimetype}</p>
                    <p><span className="text-foreground">Added:</span> {detailedFile.created_at ? new Date(detailedFile.created_at).toLocaleString() : 'Unknown'}</p>
                  </div>
                </div>

                {/* Keywords */}
                {detailedFile.keywords && detailedFile.keywords.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Keywords ({detailedFile.keywords.length})</h3>
                    <div className="flex flex-wrap gap-1">
                      {detailedFile.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frame Keywords */}
                {detailedFile.keywordFrameMap && Object.keys(detailedFile.keywordFrameMap).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Keywords by Frame</h3>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {Object.entries(detailedFile.keywordFrameMap).slice(0, 20).map(([keyword, frames]) => (
                        <div key={keyword} className="flex items-center justify-between text-xs">
                          <span className="truncate">{keyword}</span>
                          <span className="text-muted-foreground">
                            Frames: {(frames as number[]).join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {detailedFile.tags && detailedFile.tags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Tags</h3>
                    <div className="flex flex-wrap gap-1">
                      {detailedFile.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
