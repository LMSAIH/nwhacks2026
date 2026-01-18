import { Button } from '@/components/ui/button'
import { Upload, Sparkles, Loader2 } from 'lucide-react'
import type { FileType } from './types'

interface ActionButtonsProps {
  loading: boolean
  selectedType: FileType
  onUploadOnly: () => void
  onAnalyzeWithAI: () => void
}

export function ActionButtons({ 
  loading, 
  selectedType, 
  onUploadOnly, 
  onAnalyzeWithAI 
}: ActionButtonsProps) {
  // AI analysis is available for videos, audio, documents, and images
  const isAISupported = selectedType === 'video' || selectedType === 'audio' || selectedType === 'document' || selectedType === 'image' || selectedType === 'all'

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={onUploadOnly}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Add to Library
      </Button>
      
      <Button
        size="sm"
        className="w-full justify-start gap-2"
        onClick={onAnalyzeWithAI}
        disabled={loading || !isAISupported}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Analyze with AI
      </Button>
    </div>
  )
}
