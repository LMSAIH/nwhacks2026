import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  Trash2,
  Film,
  Star
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface VideoCardProps {
  file: FileRecord
  onDelete: (id: number) => void
  onSelect: (file: FileRecord) => void
  onToggleFavorite?: (id: number) => void
}

export function VideoCard({ file, onDelete, onSelect, onToggleFavorite }: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
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

  // Convert filepath to URL for video playback
  const videoSrc = getMediaUrl(file.filepath)

  // Get filename without extension
  const displayName = file.filename.replace(/\.[^/.]+$/, '')

  
  return (
    <div 
      className="group relative w-full h-full overflow-hidden rounded-xl cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all bg-black"
      onClick={() => onSelect(file)}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
        muted
      />
      
      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Button
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>
      </div>

      {/* Favorite Button - always visible when favorited */}
      <Button
        size="icon"
        variant="ghost"
        className={`absolute top-2 right-10 h-7 w-7 transition-opacity bg-black/40 hover:bg-black/60 ${file.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite?.(file.id)
        }}
      >
        <Star className={`h-3.5 w-3.5 ${file.is_favorite ? 'fill-primary text-primary' : 'text-white'}`} />
      </Button>

      {/* Delete Button */}
      <Button
        size="icon"
        variant="destructive"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(file.id)
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Video Badge */}
      <div className="absolute top-2 left-2 p-1.5 bg-black/60 rounded-lg">
        <Film className="h-3.5 w-3.5 text-white" />
      </div>

      {/* Title Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <h3 className="font-medium text-sm text-white truncate" title={file.filename}>
          {displayName}
        </h3>
      </div>
    </div>
  )
}
