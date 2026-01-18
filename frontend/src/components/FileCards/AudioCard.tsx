import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Pause, 
  Trash2
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface AudioCardProps {
  file: FileRecord
  onDelete: (id: number) => void
  onSelect: (file: FileRecord) => void
}

export function AudioCard({ file, onDelete, onSelect }: AudioCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Convert filepath to URL for audio playback
  const audioSrc = getMediaUrl(file.filepath)

  // Get filename without extension
  const displayName = file.filename.replace(/\.[^/.]+$/, '')

  return (
    <div 
      className="group relative h-16 overflow-hidden rounded-lg cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all bg-muted/50"
      onClick={() => onSelect(file)}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Compact layout */}
      <div className="flex items-center h-full px-3 gap-3">
        {/* Play/Pause Button */}
        <Button
          size="icon"
          variant="secondary"
          className="h-9 w-9 rounded-full flex-shrink-0"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        
        {/* Waveform visualization */}
        <div className="flex items-center gap-0.5 h-6 flex-1">
          {[...Array(16)].map((_, i) => {
            // Use deterministic heights based on index
            const heights = [40, 70, 55, 85, 45, 90, 60, 75, 50, 80, 65, 95, 55, 70, 45, 85]
            return (
              <div
                key={i}
                className="w-0.5 bg-primary/50 rounded-full"
                style={{ 
                  height: `${heights[i]}%`,
                  transform: isPlaying ? 'scaleY(1)' : 'scaleY(0.6)',
                  transition: `transform 0.15s ease ${i * 0.02}s`,
                  animation: isPlaying ? `waveform 0.5s ease-in-out ${i * 0.05}s infinite alternate` : 'none'
                }}
              />
            )
          })}
        </div>
        <style>{`
          @keyframes waveform {
            0% { transform: scaleY(0.5); }
            100% { transform: scaleY(1); }
          }
        `}</style>
        
        {/* Title */}
        <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
          {displayName}
        </span>
        
        {/* Delete Button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(file.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
