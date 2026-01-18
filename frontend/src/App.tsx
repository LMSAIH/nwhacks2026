import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { FileGrid } from '@/components/FileGrid'
import { CreateNoteModal } from '@/components/CreateNoteModal'
import { api } from '@/lib/api'
import type { FileRecord, SemanticSearchResult } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

export type ContentType = 'all' | 'video' | 'image' | 'audio' | 'text' | 'document' | 'notes' | 'favorites'

function App() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([])
  const [isSemanticSearch, setIsSemanticSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ContentType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchConfidence, setSearchConfidence] = useState(0.3)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreateNoteModalOpen, setIsCreateNoteModalOpen] = useState(false)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set())
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>(() => {
    // Load from localStorage on init
    try {
      const saved = localStorage.getItem('recentFiles')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  
  // Debounce search for performance (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Convert search results to FileRecord format for FileGrid
  const displayFiles = useMemo((): FileRecord[] => {
    if (isSemanticSearch && searchResults.length > 0) {
      return searchResults.map(result => ({
        id: result.file_id,
        filename: result.filename,
        filepath: result.filepath,
        filetype: result.filetype,
        size: result.size,
        mimetype: result.mimetype,
        created_at: result.created_at,
        metadata: result.metadata,
        keywords: result.keywords,
        // Include matched keywords info in metadata for potential highlighting
        tags: result.matchedKeywords?.map(mk => mk.keyword)
      }))
    }
    return files
  }, [isSemanticSearch, searchResults, files])

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setIsSemanticSearch(false)
    try {
      // Handle favorites filter client-side
      if (filter === 'favorites') {
        const result = await api.getFiles()
        if (result.success) {
          setFiles(result.files.filter(f => f.is_favorite))
        }
      } else {
        const result = await api.getFiles(filter === 'all' ? undefined : filter)
        if (result.success) {
          setFiles(result.files)
        }
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Fetch files when filter changes
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      fetchFiles()
    }
  }, [filter, debouncedSearchQuery, fetchFiles])

  // Handle debounced semantic search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([])
        setIsSemanticSearch(false)
        return // fetchFiles is called in the other effect
      }
      setLoading(true)
      setIsSemanticSearch(true)
      try {
        // Use semantic search for AI-powered results
        const result = await api.semanticSearch({
          q: debouncedSearchQuery,
          topK: 20,
          minSimilarity: searchConfidence,
          type: filter === 'all' ? undefined : filter
        })
        if (result.success) {
          setSearchResults(result.results)
        }
      } catch (error) {
        console.error('Semantic search failed:', error)
        // Fallback to keyword search
        try {
          const fallbackResult = await api.searchFiles({ q: debouncedSearchQuery, keyword: debouncedSearchQuery })
          if (fallbackResult.success) {
            setFiles(fallbackResult.files)
            setIsSemanticSearch(false)
          }
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError)
        }
      } finally {
        setLoading(false)
      }
    }

    performSearch()
  }, [debouncedSearchQuery, filter, searchConfidence])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleConfidenceChange = (confidence: number) => {
    setSearchConfidence(confidence)
  }

  const handleFilterChange = (newFilter: ContentType) => {
    setFilter(newFilter)
  }

  const handleCreateNote = () => {
    setIsCreateNoteModalOpen(true)
  }

  const handleNoteCreated = (file: FileRecord) => {
    // Add the new file to the list and refresh
    fetchFiles()
  }

  const handleSelectionChange = (ids: Set<number>) => {
    setSelectedFileIds(ids)
  }

  // Track recently opened files
  const addToRecentFiles = useCallback((file: FileRecord) => {
    setRecentFiles(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(f => f.id !== file.id)
      const updated = [file, ...filtered].slice(0, 5) // Keep only last 5
      localStorage.setItem('recentFiles', JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleDeleteSelected = async () => {
    if (selectedFileIds.size === 0) return
    
    const count = selectedFileIds.size
    if (!confirm(`Are you sure you want to delete ${count} file${count > 1 ? 's' : ''}?`)) return
    
    try {
      // Delete all selected files
      await Promise.all(
        Array.from(selectedFileIds).map(id => api.deleteFile(id))
      )
      setSelectedFileIds(new Set())
      fetchFiles()
    } catch (error) {
      console.error('Failed to delete files:', error)
    }
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      const result = await api.toggleFavorite(id)
      if (result.success) {
        // Update the local state to reflect the change
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, is_favorite: result.is_favorite } : f
        ))
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  const handleCreateFolder = () => {
    console.log('Create new folder')
  }

  // Command Palette actions
  const handleUpload = () => {
    // Click the add file button programmatically
    const addButton = document.querySelector('[data-add-file-button]') as HTMLButtonElement
    addButton?.click()
  }

  const handleProcessAI = async () => {
    if (files.length === 0) {
      console.log('No files to process')
      return
    }
    setIsProcessing(true)
    try {
      // Process video files with AI
      const videoFiles = files.filter(f => f.filetype === 'video')
      if (videoFiles.length > 0) {
        const filepaths = videoFiles.map(f => f.filepath)
        const result = await api.processVideos(filepaths)
        if (result.success) {
          console.log('AI processing complete:', result)
          fetchFiles() // Refresh to show updated data
        }
      } else {
        console.log('No video files to process')
      }
    } catch (error) {
      console.error('AI processing failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddTags = () => {
    // For now, log action - could open a tag modal
    console.log('Add tags action triggered')
    // TODO: Implement tag modal
  }

  const handleOpenFolder = async () => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const folders = await window.electronAPI.openFolder()
        if (folders && folders.length > 0) {
          console.log('Selected folder:', folders[0])
          // TODO: Process folder contents
        }
      } catch (error) {
        console.error('Failed to open folder:', error)
      }
    } else {
      console.log('Open folder only available in Electron')
    }
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar 
        onCreateNote={handleCreateNote}
        onFilterChange={handleFilterChange}
        currentFilter={filter}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={selectedFileIds.size > 0}
        recentFiles={recentFiles}
        onFileSelect={addToRecentFiles}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar 
          onSearch={handleSearch}
          onUpload={handleUpload}
          onProcessAI={handleProcessAI}
          onAddTags={handleAddTags}
          onOpenFolder={handleOpenFolder}
          onFilesAdded={fetchFiles}
          searchConfidence={searchConfidence}
          onConfidenceChange={handleConfidenceChange}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                <span>Processing with AI...</span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {debouncedSearchQuery.trim() 
                  ? (
                    <span className="flex items-center gap-2">
                      {isSemanticSearch && (
                        <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">AI Search</span>
                      )}
                      Results for "{debouncedSearchQuery}"
                    </span>
                  )
                  : filter === 'all' 
                    ? 'All Files' 
                    : filter === 'notes'
                      ? 'Notes'
                      : filter === 'favorites'
                        ? 'Favorites'
                        : `${filter.charAt(0).toUpperCase() + filter.slice(1)}s`
                }
                <span className="text-muted-foreground font-normal ml-2">
                  ({displayFiles.length})
                </span>
              </h2>
            </div>

            {/* File Grid - shows filtered results when searching */}
            <FileGrid 
              files={displayFiles} 
              loading={loading} 
              onRefresh={fetchFiles}
              selectedIds={selectedFileIds}
              onSelectionChange={handleSelectionChange}
              onToggleFavorite={handleToggleFavorite}
              onFileOpen={addToRecentFiles}
            />
          </div>
        </main>
      </div>

      {/* Create Note Modal */}
      <CreateNoteModal
        isOpen={isCreateNoteModalOpen}
        onClose={() => setIsCreateNoteModalOpen(false)}
        onCreated={handleNoteCreated}
      />
    </div>
  )
}

export default App
