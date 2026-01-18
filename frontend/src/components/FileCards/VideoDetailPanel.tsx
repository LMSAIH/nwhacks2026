import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X,
  Tag,
  Film,
  Clock,
  HardDrive,
  Calendar,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface VideoDetailPanelProps {
  file: FileRecord
  onClose: () => void
}

export function VideoDetailPanel({ file, onClose }: VideoDetailPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const videoSrc = getMediaUrl(file.filepath)

  // Get metadata
  const fileDuration = file.metadata?.duration ? parseFloat(file.metadata.duration) : undefined

  // Extract all frame timestamps from keywordFrameMap for markers
  const frameTimestamps = useMemo(() => {
    if (!file.keywordFrameMap) return []
    const timestamps = new Set<number>()
    Object.values(file.keywordFrameMap).forEach(frames => {
      if (Array.isArray(frames)) {
        frames.forEach(f => {
          if (typeof f === 'object' && f !== null && 'timestamp' in f) {
            timestamps.add((f as { timestamp: number }).timestamp)
          }
        })
      }
    })
    return Array.from(timestamps).sort((a, b) => a - b)
  }, [file.keywordFrameMap])

  // Sort keywords by their earliest timestamp
  const sortedKeywordFrames = useMemo(() => {
    if (!file.keywordFrameMap) return []
    
    const getEarliestTimestamp = (frames: unknown): number => {
      if (Array.isArray(frames)) {
        const timestamps = frames
          .filter(f => typeof f === 'object' && f !== null && 'timestamp' in f)
          .map(f => (f as { timestamp: number }).timestamp)
        return timestamps.length > 0 ? Math.min(...timestamps) : Infinity
      }
      if (typeof frames === 'object' && frames !== null && 'timestamp' in frames) {
        return (frames as { timestamp: number }).timestamp
      }
      return Infinity
    }
    
    return Object.entries(file.keywordFrameMap)
      .map(([keyword, frames]) => ({ keyword, frames, earliestTime: getEarliestTimestamp(frames) }))
      .sort((a, b) => a.earliestTime - b.earliestTime)
  }, [file.keywordFrameMap])

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
    if (videoRef.current) {
      videoRef.current.pause()
    }
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
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration || fileDuration || 0)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('loadedmetadata', updateDuration)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('loadedmetadata', updateDuration)
      video.removeEventListener('ended', handleEnded)
    }
  }, [fileDuration])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const seekToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen()
      }
    }
  }

  // Format frame data for display
  const formatFrameTimestamps = (frames: unknown): string[] => {
    if (Array.isArray(frames)) {
      return frames
        .filter(f => typeof f === 'object' && f !== null && 'timestamp' in f)
        .map(f => formatTime((f as { timestamp: number }).timestamp))
    }
    if (typeof frames === 'object' && frames !== null && 'timestamp' in frames) {
      return [formatTime((frames as { timestamp: number }).timestamp)]
    }
    return []
  }

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
        {/* Main Video Area */}
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
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-lg text-[11px] font-medium text-primary uppercase tracking-wide">
                  <Film className="h-3.5 w-3.5" />
                  Video
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

          {/* Video Display */}
          <div className="flex-1 flex flex-col bg-black/95 p-6">
            {/* Video */}
            <div className="flex-1 flex items-center justify-center relative">
              <video
                ref={videoRef}
                src={videoSrc}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={togglePlay}
              />
              
              {/* Play overlay when paused */}
              {!isPlaying && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="h-8 w-8 text-white ml-1" />
                  </div>
                </button>
              )}
            </div>

            {/* Custom Controls */}
            <div className="mt-4 space-y-3">
              {/* Progress bar with frame markers */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/70 w-10">{formatTime(currentTime)}</span>
                <div className="relative flex-1 h-2">
                  {/* Background track */}
                  <div className="absolute inset-0 bg-white/20 rounded-full" />
                  
                  {/* Progress */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                  
                  {/* Frame markers */}
                  {duration > 0 && frameTimestamps.map((timestamp, i) => (
                    <button
                      key={i}
                      onClick={() => seekToTime(timestamp)}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full hover:scale-150 transition-transform z-10"
                      style={{ left: `${(timestamp / duration) * 100}%` }}
                      title={`Frame at ${formatTime(timestamp)}`}
                    />
                  ))}
                  
                  {/* Invisible range input for seeking */}
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-xs text-white/70 w-10 text-right">{formatTime(duration)}</span>
              </div>

              {/* Frame count indicator */}
              {frameTimestamps.length > 0 && (
                <div className="text-[10px] text-white/50 text-center">
                  {frameTimestamps.length} analyzed frames • Click yellow markers to jump
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={togglePlay}
                    className="h-9 w-9 text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleMute}
                    className="h-9 w-9 text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleFullscreen}
                  className="h-9 w-9 text-white hover:bg-white/20"
                >
                  <Maximize2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 border-l border-border/50 bg-white/30 dark:bg-black/10 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Keywords */}
            {file.keywords && file.keywords.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Tag className="h-4 w-4 text-primary" />
                  Keywords ({file.keywords.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {file.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Frame Keywords Map - Clickable to seek */}
            {sortedKeywordFrames.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  Keywords by Timestamp
                  <span className="text-muted-foreground font-normal text-xs">({sortedKeywordFrames.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Click to jump to that moment in the video
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {sortedKeywordFrames.map(({ keyword, frames, earliestTime }) => {
                    const timestamps = formatFrameTimestamps(frames)
                    return (
                      <button
                        key={keyword}
                        onClick={() => seekToTime(earliestTime)}
                        className="w-full flex items-start justify-between gap-2 text-xs p-3 bg-secondary/50 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer text-left group"
                      >
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {keyword}
                        </span>
                        <span className="text-primary font-medium flex-shrink-0">
                          {timestamps.length > 0 ? timestamps.join(', ') : `Frame ${earliestTime}`}
                        </span>
                      </button>
                    )
                  })}
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
            {(!file.keywords || file.keywords.length === 0) && sortedKeywordFrames.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No AI analysis available</p>
                <p className="text-xs mt-1">Process the video to analyze frames</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
