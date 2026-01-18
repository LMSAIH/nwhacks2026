import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface ImageCardProps {
  file: FileRecord
  onDelete: (id: number) => void
  onSelect: (file: FileRecord) => void
}

export function ImageCard({ file, onDelete, onSelect }: ImageCardProps) {
  // Convert filepath to URL for image display
  const imageSrc = getMediaUrl(file.filepath)

  // Get filename without extension and truncate
  const displayName = file.filename.replace(/\.[^/.]+$/, '')

  return (
    <div 
      className="group relative w-full h-full overflow-hidden rounded-xl cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all bg-secondary"
      onClick={() => onSelect(file)}
    >
      <img
        src={imageSrc}
        alt={file.filename}
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
        }}
      />

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

      {/* Title Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <h3 className="font-medium text-sm text-white truncate" title={file.filename}>
          {displayName}
        </h3>
      </div>
    </div>
  )
}
