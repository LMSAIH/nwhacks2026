import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X,
  Tag,
  Image,
  FileText,
  Calendar,
  HardDrive
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface ImageDetailPanelProps {
  file: FileRecord
  onClose: () => void
}

export function ImageDetailPanel({ file, onClose }: ImageDetailPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const imageSrc = getMediaUrl(file.filepath)
  const description = file.metadata?.description

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Trigger enter animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 400)
  }, [onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-400 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      />

      {/* Modal Container */}
      <div 
        className={`fixed inset-4 md:inset-8 lg:inset-12 xl:inset-16 z-50 flex bg-[#fafafa] dark:bg-[#0f0f0f] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${
          isVisible 
            ? 'opacity-100 scale-100 translate-y-0' 
            : isClosing 
              ? 'opacity-0 scale-95 translate-y-4'
              : 'opacity-0 scale-95 translate-y-8'
        }`}
        style={{ 
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Main Image Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-white/50 dark:bg-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              {/* Close Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleClose}
                className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* File Info */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 rounded-lg text-[11px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                  <Image className="h-3.5 w-3.5" />
                  Image
                </div>
                
                <h1 
                  className="text-base font-semibold text-foreground truncate max-w-md"
                  style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
                >
                  {file.filename}
                </h1>
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {formatSize(file.size)}
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(file.created_at)}
              </div>
            </div>
          </header>

          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-8 bg-secondary/30">
            <img
              src={imageSrc}
              alt={file.filename}
              className="max-w-screen-lg max-h-3/4 object-contain rounded-lg shadow-lg"
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 border-l border-border/50 bg-white/30 dark:bg-black/10 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* AI Description */}
            {description && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-blue-500" />
                  AI Description
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed bg-secondary/50 p-4 rounded-xl">
                  {description}
                </p>
              </div>
            )}

            {/* Keywords */}
            {file.keywords && file.keywords.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Tag className="h-4 w-4 text-green-500" />
                  Keywords ({file.keywords.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {file.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-300 rounded-full text-xs font-medium"
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
                <h3 className="text-sm font-medium text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {file.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* No AI Data Message */}
            {!description && (!file.keywords || file.keywords.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No AI analysis available</p>
                <p className="text-xs mt-1">Upload the image to analyze it</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
