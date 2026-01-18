import { Button } from '@/components/ui/button'
import { 
  Upload,
  Sparkles,
  Tag,
  FolderOpen,
  Command,
  ChevronDown,
  SlidersHorizontal,
  X,
  Clock,
  Trash2,
  Database,
  Sun,
  Moon
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import { useTheme } from '@/hooks/useTheme'
import { AddFileButton } from '@/components/AddFile'
import { api } from '@/lib/api'

interface TopBarProps {
  onSearch?: (query: string) => void
  onUpload?: () => void
  onProcessAI?: () => void
  onAddTags?: () => void
  onOpenFolder?: () => void
  onFilesAdded?: () => void
  searchConfidence?: number
  onConfidenceChange?: (confidence: number) => void
}

export function TopBar({ onSearch, onUpload, onProcessAI, onAddTags, onOpenFolder, onFilesAdded, searchConfidence = 0.3, onConfidenceChange }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showConfidence, setShowConfidence] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const commandsRef = useRef<HTMLDivElement>(null)
  const confidenceRef = useRef<HTMLDivElement>(null)
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory()
  const { theme, toggleTheme } = useTheme()

  const handleIndexKeywords = async () => {
    setIsIndexing(true)
    try {
      const result = await api.indexKeywords()
      if (result.success) {
        console.log(`Indexed ${result.indexed} keywords for semantic search`)
      }
    } catch (error) {
      console.error('Failed to index keywords:', error)
    } finally {
      setIsIndexing(false)
    }
  }

  const commands = [
    { id: 'upload', label: 'Upload Files', icon: Upload, shortcut: '⌘U', action: onUpload },
    { id: 'process', label: 'Process with AI', icon: Sparkles, shortcut: '⌘P', action: onProcessAI },
    { id: 'tags', label: 'Add Tags', icon: Tag, shortcut: '⌘T', action: onAddTags },
    { id: 'folder', label: 'Open Folder', icon: FolderOpen, shortcut: '⌘O', action: onOpenFolder },
    { id: 'index', label: isIndexing ? 'Indexing...' : 'Index for Search', icon: Database, shortcut: '⌘I', action: handleIndexKeywords },
  ]

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    onSearch?.(e.target.value)
  }

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    onSearch?.('')
    inputRef.current?.focus()
  }, [onSearch])

  // Add to history when user stops typing (on blur or enter)
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim())
    }
    setShowHistory(false)
  }, [searchQuery, addToHistory])

  const handleHistoryItemClick = (term: string) => {
    setSearchQuery(term)
    onSearch?.(term)
    addToHistory(term)
    setShowHistory(false)
  }

  // Keyboard shortcut: Cmd/Ctrl + K to focus search, and command shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const isTyping = document.activeElement?.tagName === 'INPUT' || 
                       document.activeElement?.tagName === 'TEXTAREA'

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setShowHistory(true)
      }
      
      // Command shortcuts (only when not typing)
      if ((e.metaKey || e.ctrlKey) && !isTyping) {
        switch (e.key.toLowerCase()) {
          case 'u':
            e.preventDefault()
            onUpload?.()
            break
          case 'p':
            e.preventDefault()
            onProcessAI?.()
            break
          case 't':
            e.preventDefault()
            onAddTags?.()
            break
          case 'o':
            e.preventDefault()
            onOpenFolder?.()
            break
        }
      }

      // Escape to clear and blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        clearSearch()
        setShowHistory(false)
        inputRef.current?.blur()
      }
      // Enter to submit and save to history
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        handleSearchSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSearch, handleSearchSubmit, onUpload, onProcessAI, onAddTags, onOpenFolder])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
      if (commandsRef.current && !commandsRef.current.contains(e.target as Node)) {
        setShowCommands(false)
      }
      if (confidenceRef.current && !confidenceRef.current.contains(e.target as Node)) {
        setShowConfidence(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 sticky top-0 z-10">
      {/* Search Bar */}
      <div className="flex-1 max-w-md" ref={dropdownRef}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="AI Search... (⌘K)"
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setShowHistory(true)}
            onBlur={() => {
              // Delay to allow click on history items
              setTimeout(() => handleSearchSubmit(), 200)
            }}
            className="w-full h-9 pl-9 pr-10 rounded-md bg-secondary border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search History Dropdown */}
          {showHistory && history.length > 0 && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clearHistory()
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <div className="max-h-48 overflow-auto">
                {history.map((term, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 hover:bg-secondary cursor-pointer group"
                    onClick={() => handleHistoryItemClick(term)}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{term}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        removeFromHistory(term)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Palette & Actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* Theme Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Commands Dropdown */}
        <div className="relative" ref={commandsRef}>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setShowCommands(!showCommands)}
          >
            <Command className="h-4 w-4" />
            Commands
            <ChevronDown className={`h-3 w-3 transition-transform ${showCommands ? 'rotate-180' : ''}`} />
          </Button>

          {/* Commands Dropdown Menu */}
          {showCommands && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-lg overflow-hidden z-50">
              <div className="py-1">
                {commands.map((cmd) => (
                  <button
                    key={cmd.id}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary transition-colors"
                    onClick={() => {
                      cmd.action?.()
                      setShowCommands(false)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <cmd.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{cmd.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{cmd.shortcut}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confidence/Similarity Control */}
        <div className="relative" ref={confidenceRef}>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setShowConfidence(!showConfidence)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {Math.round(searchConfidence * 100)}%
            <ChevronDown className={`h-3 w-3 transition-transform ${showConfidence ? 'rotate-180' : ''}`} />
          </Button>

          {/* Confidence Dropdown */}
          {showConfidence && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden z-50 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Search Confidence</span>
                  <span className="text-sm text-primary font-medium">{Math.round(searchConfidence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={searchConfidence * 100}
                  onChange={(e) => onConfidenceChange?.(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>More results</span>
                  <span>More precise</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher confidence shows only closely matching results. Lower confidence includes broader matches.
                </p>
              </div>
            </div>
          )}
        </div>

        <AddFileButton onComplete={onFilesAdded || (() => {})} />
      </div>
    </header>
  )
}
