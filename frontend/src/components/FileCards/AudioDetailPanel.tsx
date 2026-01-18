import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X,
  Tag,
  Mic,
  HardDrive,
  Calendar,
  MessageSquareText,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { getMediaUrl } from '@/lib/utils'

interface AudioDetailPanelProps {
  file: FileRecord
  onClose: () => void
}

export function AudioDetailPanel({ file, onClose }: AudioDetailPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const audioSrc = getMediaUrl(file.filepath)

  // Get metadata
  const transcription = file.metadata?.transcription
  const fileDuration = file.metadata?.duration ? parseFloat(file.metadata.duration) : undefined

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
    if (audioRef.current) {
      audioRef.current.pause()
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
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration || fileDuration || 0)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [fileDuration])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
        className={`fixed inset-4 md:inset-8 lg:inset-12 xl:inset-16 z-50 flex flex-col bg-[#fafafa] dark:bg-[#0f0f0f] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ${
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
            <h1 
              className="text-lg font-bold text-foreground truncate max-w-md tracking-tight"
            >
              {file.filename.replace(/\.[^/.]+$/, '')}
            </h1>
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

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Audio Player Section */}
          <div className="w-1/3 flex flex-col items-center justify-start p-8 pt-12 border-r border-border/30">
            <audio ref={audioRef} src={audioSrc} />
            
            {/* Waveform visualization */}
            <div className="flex items-center justify-center h-24 mb-6">
              <div className="flex items-end gap-1.5 h-full">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 bg-primary/50 rounded-full transition-all duration-150 ${
                      isPlaying ? 'animate-pulse' : ''
                    }`}
                    style={{ 
                      height: `${30 + Math.random() * 70}%`,
                      animationDelay: `${i * 30}ms`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-xs space-y-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
              </Button>
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl space-y-6">
              {/* Transcription */}
              {transcription && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    Transcription
                  </h2>
                  <div className="bg-secondary/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {transcription}
                    </p>
                  </div>
                </div>
              )}

              {/* Keywords */}
              {file.keywords && file.keywords.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
                    <Tag className="h-4 w-4 text-primary" />
                    Keywords
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {file.keywords.map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-sm"
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
                  <h2 className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
                    <Tag className="h-4 w-4 text-primary" />
                    Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {file.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* No Data Message */}
              {!transcription && (!file.keywords || file.keywords.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mic className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No analysis available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
