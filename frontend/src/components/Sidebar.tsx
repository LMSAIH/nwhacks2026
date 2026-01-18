import { Button } from '@/components/ui/button'
import { 
  Plus, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Star,
  Clock,
  Trash2,
  LayoutGrid
} from 'lucide-react'
import { type ContentType } from '@/App'

interface SidebarProps {
  onCreateNote?: () => void
  onFilterChange?: (filter: ContentType) => void
  currentFilter?: ContentType
  onDeleteSelected?: () => void
  hasSelection?: boolean
}

export function Sidebar({ onCreateNote, onFilterChange, currentFilter = 'all', onDeleteSelected, hasSelection }: SidebarProps) {
  const handleFilterClick = (filter: ContentType) => {
    onFilterChange?.(filter)
  }

  return (
    <aside className="w-60 h-screen bg-secondary/50 border-r border-border flex flex-col">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-border">
        <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-background text-xs font-bold">O</span>
          </div>
          Omni
        </h1>
      </div>

      {/* Quick Actions */}
      <div className="p-3 space-y-1">
        <Button 
          onClick={onCreateNote}
          className="w-full justify-start gap-2 h-9 text-sm"
        >
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground px-2 py-2">
          Navigate
        </p>
        <Button 
          variant={currentFilter === 'all' ? 'secondary' : 'ghost'} 
          className={`w-full justify-start gap-2 h-9 text-sm ${currentFilter !== 'all' ? 'text-muted-foreground hover:text-foreground' : ''}`}
          onClick={() => handleFilterClick('all')}
        >
          <LayoutGrid className="h-4 w-4" />
          All Files
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-sm text-muted-foreground hover:text-foreground">
          <Star className="h-4 w-4" />
          Favorites
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-sm text-muted-foreground hover:text-foreground">
          <Clock className="h-4 w-4" />
          Recent
        </Button>

        <p className="text-xs font-medium text-muted-foreground px-2 py-2 mt-4">
          Content Types
        </p>
        <Button 
          variant={currentFilter === 'notes' ? 'secondary' : 'ghost'} 
          className={`w-full justify-start gap-2 h-9 text-sm ${currentFilter !== 'notes' ? 'text-muted-foreground hover:text-foreground' : ''}`}
          onClick={() => handleFilterClick('notes')}
        >
          <FileText className="h-4 w-4" />
          Notes
        </Button>
        <Button 
          variant={currentFilter === 'image' ? 'secondary' : 'ghost'} 
          className={`w-full justify-start gap-2 h-9 text-sm ${currentFilter !== 'image' ? 'text-muted-foreground hover:text-foreground' : ''}`}
          onClick={() => handleFilterClick('image')}
        >
          <Image className="h-4 w-4" />
          Images
        </Button>
        <Button 
          variant={currentFilter === 'video' ? 'secondary' : 'ghost'} 
          className={`w-full justify-start gap-2 h-9 text-sm ${currentFilter !== 'video' ? 'text-muted-foreground hover:text-foreground' : ''}`}
          onClick={() => handleFilterClick('video')}
        >
          <Video className="h-4 w-4" />
          Videos
        </Button>
        <Button 
          variant={currentFilter === 'audio' ? 'secondary' : 'ghost'} 
          className={`w-full justify-start gap-2 h-9 text-sm ${currentFilter !== 'audio' ? 'text-muted-foreground hover:text-foreground' : ''}`}
          onClick={() => handleFilterClick('audio')}
        >
          <Music className="h-4 w-4" />
          Audio
        </Button>
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-border space-y-1">
        <Button 
          variant="ghost" 
          className={`w-full justify-start gap-2 h-9 text-sm ${hasSelection ? 'text-destructive hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={onDeleteSelected}
          disabled={!hasSelection}
        >
          <Trash2 className="h-4 w-4" />
          {hasSelection ? 'Delete Selected' : 'Trash'}
        </Button>
      </div>
    </aside>
  )
}
