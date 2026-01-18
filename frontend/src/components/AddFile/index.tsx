import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useFileUpload } from './useFileUpload'
import { FileTypeMenu } from './FileTypeMenu'
import { SelectedFilesPanel } from './SelectedFilesPanel'

interface AddFileButtonProps {
  onComplete: () => void
}

export function AddFileButton({ onComplete }: AddFileButtonProps) {
  const {
    isOpen,
    setIsOpen,
    selectedType,
    selectedFiles,
    loading,
    status,
    fileInputRef,
    handleSelectType,
    handleBrowserFileChange,
    handleUploadOnly,
    handleAnalyzeWithAI,
    resetAndClose,
    removeFile,
    goBack
  } = useFileUpload({ onComplete })

  return (
    <div className="relative">
      {/* Hidden file input for browser mode */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleBrowserFileChange}
        className="hidden"
      />

      {/* Main Add Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
        data-add-file-button
      >
        <Plus className="h-4 w-4" />
        Add Files
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={resetAndClose}
          />
          
          {/* Menu Card */}
          <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg">
            <div className="p-2">
              {/* Step 1: Choose file type */}
              {!selectedType && (
                <FileTypeMenu onSelectType={handleSelectType} />
              )}

              {/* Step 2: Selected files & actions */}
              {selectedType && (
                <SelectedFilesPanel
                  selectedType={selectedType}
                  selectedFiles={selectedFiles}
                  loading={loading}
                  status={status}
                  onGoBack={goBack}
                  onRemoveFile={removeFile}
                  onUploadOnly={handleUploadOnly}
                  onAnalyzeWithAI={handleAnalyzeWithAI}
                />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
