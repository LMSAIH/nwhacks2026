import { useState, useEffect, useCallback } from 'react'
import { 
  X,
  FileText,
  FileType,
  Check,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { FileRecord } from '@/lib/api'

type NoteType = 'md' | 'txt'

interface CreateNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (file: FileRecord) => void
}

export function CreateNoteModal({ isOpen, onClose, onCreated }: CreateNoteModalProps) {
  const [filename, setFilename] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('md')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilename('')
      setNoteType('md')
      setError(null)
      setIsClosing(false)
      // Trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300)
  }, [onClose])

  // Handle create
  const handleCreate = async () => {
    if (!filename.trim()) {
      setError('Please enter a filename')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const result = await api.createDocument(filename.trim(), '', noteType)
      
      if (result.success && result.file) {
        onCreated(result.file)
        handleClose()
      } else {
        setError(result.error || 'Failed to create note')
      }
    } catch (err) {
      console.error('Failed to create note:', err)
      setError('Failed to create note. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleCreate()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, filename, noteType])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className={`w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isVisible 
              ? 'opacity-100 scale-100 translate-y-0' 
              : isClosing 
                ? 'opacity-0 scale-95 translate-y-4'
                : 'opacity-0 scale-95 translate-y-8'
          }`}
          style={{ 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h2 className="text-lg font-semibold text-foreground">Create New Note</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClose}
              className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Filename Input */}
            <div className="space-y-2">
              <label htmlFor="filename" className="text-sm font-medium text-foreground">
                Filename
              </label>
              <input
                id="filename"
                type="text"
                value={filename}
                onChange={(e) => {
                  setFilename(e.target.value)
                  setError(null)
                }}
                placeholder="My new note"
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The extension will be added automatically based on the note type
              </p>
            </div>

            {/* Note Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Note Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNoteType('md')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    noteType === 'md'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <FileType className={`h-5 w-5 ${noteType === 'md' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-left">
                    <div className={`font-medium ${noteType === 'md' ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Markdown
                    </div>
                    <div className="text-xs text-muted-foreground">.md</div>
                  </div>
                  {noteType === 'md' && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setNoteType('txt')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    noteType === 'txt'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <FileText className={`h-5 w-5 ${noteType === 'txt' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-left">
                    <div className={`font-medium ${noteType === 'txt' ? 'text-foreground' : 'text-muted-foreground'}`}>
                      Plain Text
                    </div>
                    <div className="text-xs text-muted-foreground">.txt</div>
                  </div>
                  {noteType === 'txt' && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50 bg-muted/30">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !filename.trim()}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create Note
                </>
              )}
            </Button>
          </footer>
        </div>
      </div>
    </>
  )
}
