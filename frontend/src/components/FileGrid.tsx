import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { 
  Loader2,
  Files
} from 'lucide-react'
import type { FileRecord } from '@/lib/api'
import { api } from '@/lib/api'
import { 
  VideoCard, 
  AudioCard, 
  ImageCard, 
  DocumentCard,
  VideoDetailPanel,
  AudioDetailPanel,
  ImageDetailPanel,
  DocumentEditor
} from './FileCards'

interface FileGridProps {
  files: FileRecord[]
  loading?: boolean
  onRefresh: () => void
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
}

// Calculate size class for masonry layout
function getItemSize(file: FileRecord): 'tiny' | 'small' | 'medium' | 'large' {
  // Audio is always tiny (compact bar)
  if (file.filetype === 'audio') {
    return 'tiny'
  }
  
  // Images: vary based on filename hash for visual interest
  if (file.filetype === 'image') {
    // Use filename characters + id to create more varied sizes
    const charSum = file.filename.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const hash = (file.id + charSum) % 5
    if (hash === 0 || hash === 1) return 'large'
    if (hash === 2 || hash === 3) return 'medium'
    return 'small'
  }
  
  // Videos: always small for compact grid
  if (file.filetype === 'video') {
    return 'small'
  }
  
  // Documents/text: vary based on content and id for visual interest
  if (file.filetype === 'document' || file.filetype === 'text') {
    const keywordCount = file.keywords?.length || 0
    const wordCount = file.metadata?.word_count ? parseInt(file.metadata.word_count) : 0
    
    // Larger only if lots of content
    if (wordCount > 800 || keywordCount > 6) return 'large'
    if (wordCount > 300 || keywordCount > 3) return 'medium'
    
    // Use file id for variety - prefer small/medium over large
    const hash = file.id % 5
    if (hash === 0) return 'large'
    if (hash === 1 || hash === 2) return 'medium'
    return 'small'
  }
  
  return 'small'
}

export function FileGrid({ files, loading, onRefresh, selectedIds = new Set(), onSelectionChange }: FileGridProps) {
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null)
  const [detailedFile, setDetailedFile] = useState<FileRecord | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [documentEditorFile, setDocumentEditorFile] = useState<FileRecord | null>(null)
  
  // Drag selection state
  const gridRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Handle drag selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag if clicking on the grid background, not on a card
    if ((e.target as HTMLElement).closest('[data-file-card]')) return
    
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    
    setIsDragging(true)
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragStart(point)
    setDragEnd(point)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !gridRef.current) return
    
    const rect = gridRef.current.getBoundingClientRect()
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragEnd(point)
    
    // Calculate selection box
    const left = Math.min(dragStart.x, point.x)
    const top = Math.min(dragStart.y, point.y)
    const width = Math.abs(point.x - dragStart.x)
    const height = Math.abs(point.y - dragStart.y)
    setSelectionBox({ left, top, width, height })
    
    // Check which cards intersect with selection box
    const newSelection = new Set<number>()
    cardRefs.current.forEach((cardEl, fileId) => {
      const cardRect = cardEl.getBoundingClientRect()
      const gridRect = gridRef.current!.getBoundingClientRect()
      const cardRelative = {
        left: cardRect.left - gridRect.left,
        top: cardRect.top - gridRect.top,
        right: cardRect.right - gridRect.left,
        bottom: cardRect.bottom - gridRect.top
      }
      
      // Check intersection
      if (
        cardRelative.left < left + width &&
        cardRelative.right > left &&
        cardRelative.top < top + height &&
        cardRelative.bottom > top
      ) {
        newSelection.add(fileId)
      }
    })
    onSelectionChange?.(newSelection)
  }, [isDragging, dragStart, onSelectionChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
    setSelectionBox(null)
  }, [])

  // Global mouse up to handle drag ending outside grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging, handleMouseUp])

  // Register card ref
  const setCardRef = useCallback((fileId: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(fileId, el)
    } else {
      cardRefs.current.delete(fileId)
    }
  }, [])

  // Distribute files into columns for masonry layout
  // Uses row-first distribution to preserve sort order (first items appear top-left)
  const columns = useMemo(() => {
    const numColumns = 4 // We'll use CSS to adjust for responsive
    const cols: FileRecord[][] = Array.from({ length: numColumns }, () => [])
    
    // Distribute row by row to preserve order (most relevant items appear first/top)
    files.forEach((file, index) => {
      const colIndex = index % numColumns
      cols[colIndex].push(file)
    })
    
    return cols
  }, [files])

  const handleSelect = async (file: FileRecord) => {
    // For documents, open full-screen editor instead of sidebar
    if (file.filetype === 'document' || file.filetype === 'text') {
      setDocumentEditorFile(file)
      return
    }

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
      if (documentEditorFile?.id === id) {
        setDocumentEditorFile(null)
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const closeDetail = () => {
    setSelectedFile(null)
    setDetailedFile(null)
  }

  const closeDocumentEditor = () => {
    setDocumentEditorFile(null)
  }

  // Render the appropriate card based on file type with size class
  const renderCard = (file: FileRecord) => {
    const size = getItemSize(file)
    const props = {
      file,
      onDelete: handleDelete,
      onSelect: handleSelect
    }

    // Get size-specific wrapper class
    const getSizeClass = () => {
      if (file.filetype === 'audio') {
        // Audio is compact bar - no aspect ratio needed
        return 'h-16'
      }
      if (file.filetype === 'image' || file.filetype === 'video') {
        // Images and videos scale based on size with more variation
        switch (size) {
          case 'large': return 'aspect-[4/5]'
          case 'medium': return 'aspect-[4/3]'
          default: return 'aspect-video'
        }
      }
      // Documents: use fixed heights to prevent blank space
      switch (size) {
        case 'large': return 'h-[240px]'
        case 'medium': return 'h-[200px]'
        default: return 'h-[160px]'
      }
    }

    const wrapperClass = getSizeClass()
    const isSelected = selectedIds.has(file.id)

    const card = (() => {
      switch (file.filetype) {
        case 'video':
          return <VideoCard key={file.id} {...props} />
        case 'audio':
          return <AudioCard key={file.id} {...props} />
        case 'image':
          return <ImageCard key={file.id} {...props} />
        case 'document':
        case 'text':
          return <DocumentCard key={file.id} {...props} />
        default:
          return <DocumentCard key={file.id} {...props} />
      }
    })()

    return (
      <div 
        key={file.id} 
        ref={(el) => setCardRef(file.id, el)}
        data-file-card
        className={`mb-4 ${wrapperClass} relative rounded-lg transition-all ${
          isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        }`}
        onClick={(e) => {
          // Handle click selection with Ctrl/Cmd for multi-select
          if (e.ctrlKey || e.metaKey) {
            e.stopPropagation()
            const newSelection = new Set(selectedIds)
            if (newSelection.has(file.id)) {
              newSelection.delete(file.id)
            } else {
              newSelection.add(file.id)
            }
            onSelectionChange?.(newSelection)
          }
        }}
      >
        {isSelected && (
          <div className="absolute top-2 left-2 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {card}
      </div>
    )
  }

  // Render the appropriate detail panel based on file type (not for documents)
  const renderDetailPanel = () => {
    if (!selectedFile || !detailedFile) return null

    const props = {
      file: detailedFile,
      onClose: closeDetail
    }

    if (loadingDetails) {
      return (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-xl z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    // Documents use full-screen editor, not sidebar
    switch (detailedFile.filetype) {
      case 'video':
        return <VideoDetailPanel {...props} />
      case 'audio':
        return <AudioDetailPanel {...props} />
      case 'image':
        return <ImageDetailPanel {...props} />
      case 'document':
      case 'text':
        return null // Handled by DocumentEditor
      default:
        return null
    }
  }

  // Get empty state icon and message
  const getEmptyState = () => {
    return {
      icon: Files,
      title: 'No files yet',
      subtitle: 'Add files to get started'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (files.length === 0) {
    const emptyState = getEmptyState()
    const Icon = emptyState.icon
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Icon className="h-12 w-12 mb-4" />
        <p>{emptyState.title}</p>
        <p className="text-sm">{emptyState.subtitle}</p>
      </div>
    )
  }

  return (
    <div 
      ref={gridRef}
      className="relative select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Selection Box */}
      {selectionBox && isDragging && (
        <div 
          className="absolute bg-primary/20 border border-primary rounded pointer-events-none z-20"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height
          }}
        />
      )}

      {/* Masonry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
        {columns.map((column, colIndex) => (
          <div key={colIndex} className="flex flex-col">
            {column.map(renderCard)}
          </div>
        ))}
      </div>

      {/* Detail Panel (for non-document files) */}
      {selectedFile && renderDetailPanel()}

      {/* Full-screen Document Editor */}
      {documentEditorFile && (
        <DocumentEditor
          file={documentEditorFile}
          onClose={closeDocumentEditor}
          onSave={() => {
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
