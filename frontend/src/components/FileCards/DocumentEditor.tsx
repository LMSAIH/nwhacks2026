import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X,
  Save,
  FileText,
  FileType,
  Type,
  AlignLeft,
  Clock,
  Check,
  Eye,
  Edit3,
  Columns
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FileRecord } from '@/lib/api'
import { api } from '@/lib/api'
import { MarkdownToolbar } from './MarkdownToolbar'
import { MarkdownPreview } from './MarkdownPreview'

type ViewMode = 'edit' | 'preview' | 'split'

interface DocumentEditorProps {
  file: FileRecord
  onClose: () => void
  onSave?: (content: string) => void
}

export function DocumentEditor({ file, onClose, onSave }: DocumentEditorProps) {
  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')

  const isMarkdown = file.filename.endsWith('.md')

  // Fetch document content on mount
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const result = await api.getDocumentContent(file.id)
        if (result.success && result.content) {
          setContent(result.content)
          setOriginalContent(result.content)
          updateCounts(result.content)
        }
      } catch (error) {
        console.error('Failed to fetch document content:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchContent()
    
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [file.id])

  // Update word and character counts
  const updateCounts = (text: string) => {
    setCharCount(text.length)
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
  }

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    updateCounts(newContent)
    setSaved(false)
  }

  // Handle textarea change event
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleContentChange(e.target.value)
  }

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 400) // Match animation duration
  }, [onClose])

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    console.log('Saving document:', file.id, 'content length:', content.length)
    try {
      const result = await api.saveDocumentContent(file.id, content)
      console.log('Save result:', result)
      if (result.success) {
        onSave?.(content)
        setOriginalContent(content)
        setSaved(true)
        if (result.wordCount !== undefined) setWordCount(result.wordCount)
        if (result.characterCount !== undefined) setCharCount(result.characterCount)
        setTimeout(() => setSaved(false), 2000)
      } else {
        console.error('Failed to save:', result.error)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, handleClose])

  // Focus textarea after loading
  useEffect(() => {
    if (!isLoading && textareaRef.current && viewMode !== 'preview') {
      textareaRef.current.focus()
    }
  }, [isLoading, viewMode])

  const getExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || 'file'
  }

  const getFileTypeLabel = (filename: string) => {
    const ext = getExtension(filename)
    switch (ext) {
      case 'txt': return 'Plain Text'
      case 'md': return 'Markdown'
      default: return 'Document'
    }
  }

  const hasChanges = content !== originalContent

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

      {/* Editor Container */}
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {getExtension(file.filename) === 'md' ? (
                  <FileType className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {getFileTypeLabel(file.filename)}
              </div>
              
              <h1 
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
              >
                {file.filename.replace(/\.[^/.]+$/, '')}
              </h1>

              {hasChanges && (
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="Unsaved changes" />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle (only for markdown files) */}
            {isMarkdown && (
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 mr-2">
                <Button
                  size="sm"
                  variant={viewMode === 'edit' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('edit')}
                  className="h-7 px-2.5 gap-1.5 text-xs"
                  title="Edit mode"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('split')}
                  className="h-7 px-2.5 gap-1.5 text-xs"
                  title="Split view"
                >
                  <Columns className="h-3.5 w-3.5" />
                  Split
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('preview')}
                  className="h-7 px-2.5 gap-1.5 text-xs"
                  title="Preview mode"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
              </div>
            )}

            {/* Save Status */}
            {saved && (
              <div className="flex items-center gap-1.5 text-green-500 text-sm animate-in fade-in slide-in-from-right-2 duration-300">
                <Check className="h-4 w-4" />
                <span>Saved</span>
              </div>
            )}

            {/* Save Button */}
            <Button
              size="sm"
              variant={hasChanges ? "default" : "ghost"}
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="gap-2 transition-all duration-200"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
              <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
                ⌘S
              </kbd>
            </Button>
          </div>
        </header>

        {/* Markdown Toolbar (only for markdown files in edit or split mode) */}
        {isMarkdown && viewMode !== 'preview' && (
          <MarkdownToolbar
            textareaRef={textareaRef}
            content={content}
            onContentChange={handleContentChange}
            disabled={isLoading}
          />
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Edit Mode */}
              {viewMode === 'edit' && (
                <div className="h-full p-6 md:p-10 lg:p-12 overflow-auto">
                  <div className="max-w-3xl mx-auto">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleTextareaChange}
                      placeholder="Start typing..."
                      className="w-full h-full min-h-[60vh] bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/50"
                      style={{ 
                        fontFamily: "'IBM Plex Mono', 'SF Mono', 'Fira Code', Consolas, monospace",
                        fontSize: '14px',
                        lineHeight: '1.8',
                        letterSpacing: '-0.01em'
                      }}
                      spellCheck="false"
                    />
                  </div>
                </div>
              )}

              {/* Preview Mode */}
              {viewMode === 'preview' && (
                <div className="h-full p-6 md:p-10 lg:p-12 overflow-auto">
                  <div className="max-w-3xl mx-auto">
                    {content ? (
                      <MarkdownPreview content={content} />
                    ) : (
                      <p className="text-muted-foreground/50 italic">Nothing to preview</p>
                    )}
                  </div>
                </div>
              )}

              {/* Split Mode */}
              {viewMode === 'split' && (
                <div className="h-full flex">
                  <div className="flex-1 border-r border-border/50 overflow-hidden">
                    <div className="h-full p-6 md:p-8 lg:p-10 overflow-auto">
                      <div className="max-w-none">
                        <textarea
                          ref={textareaRef}
                          value={content}
                          onChange={handleTextareaChange}
                          placeholder="Start typing..."
                          className="w-full h-full min-h-[60vh] bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/50"
                          style={{ 
                            fontFamily: "'IBM Plex Mono', 'SF Mono', 'Fira Code', Consolas, monospace",
                            fontSize: '14px',
                            lineHeight: '1.8',
                            letterSpacing: '-0.01em'
                          }}
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden bg-muted/20">
                    <div className="h-full p-6 md:p-8 lg:p-10 overflow-auto">
                      <div className="max-w-none">
                        {content ? (
                          <MarkdownPreview content={content} />
                        ) : (
                          <p className="text-muted-foreground/50 italic">Nothing to preview</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Status Bar */}
        <footer className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-white/50 dark:bg-black/20 backdrop-blur-xl text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" />
              {charCount.toLocaleString()} characters
            </span>
            <span className="flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5" />
              {wordCount.toLocaleString()} words
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              ~{Math.ceil(wordCount / 200)} min read
            </span>
            <span className="text-muted-foreground/50">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to close
            </span>
          </div>
        </footer>
      </div>
    </>
  )
}
