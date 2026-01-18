import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Upload, 
  FolderOpen, 
  Loader2, 
  Check, 
  X,
  FileVideo,
  Sparkles
} from 'lucide-react'
import { api } from '@/lib/api'
import '@/types/electron.d.ts'

interface UploadPanelProps {
  onUploadComplete: () => void
}

// Check if running in Electron
const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export function UploadPanel({ onUploadComplete }: UploadPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // For browser mode: store File objects to upload
  const [browserFiles, setBrowserFiles] = useState<File[]>([])

  const handleSelectFiles = async () => {
    if (isElectron()) {
      // Electron mode: use native file dialog
      try {
        const files = await window.electronAPI!.openFiles({
          filters: [
            { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }
          ]
        })
        if (files && files.length > 0) {
          setSelectedFiles(files)
          setStatus('idle')
          setMessage('')
        }
      } catch (error) {
        console.error('Failed to open file dialog:', error)
        setMessage('Failed to open file dialog')
        setStatus('error')
      }
    } else {
      // Browser mode: use file input
      fileInputRef.current?.click()
    }
  }

  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setBrowserFiles(fileArray)
      // Store file names for display
      setSelectedFiles(fileArray.map(f => f.name))
      setStatus('idle')
      setMessage('')
    }
  }

  const handleRegisterOnly = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setStatus('idle')
    setMessage('')

    try {
      if (isElectron()) {
        // Electron mode: register by filepath
        const result = await api.registerMultipleFiles(selectedFiles)
        if (result.success) {
          setMessage(`Registered ${result.registered} files`)
          setStatus('success')
          setSelectedFiles([])
          onUploadComplete()
        } else {
          setMessage('Failed to register files')
          setStatus('error')
        }
      } else {
        // Browser mode: upload files to server
        const result = await api.uploadFiles(browserFiles)
        if (result.success) {
          setMessage(`Uploaded ${result.files?.length || 0} files`)
          setStatus('success')
          setSelectedFiles([])
          setBrowserFiles([])
          onUploadComplete()
        } else {
          setMessage('Failed to upload files')
          setStatus('error')
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      setMessage('Failed to register files. Make sure the backend is running.')
      setStatus('error')
    } finally {
      setUploading(false)
    }
  }

  const handleProcessVideos = async () => {
    if (selectedFiles.length === 0) return

    setProcessing(true)
    setStatus('idle')
    setMessage('Analyzing videos with AI... This may take a while.')

    try {
      if (isElectron()) {
        // Electron mode: process by filepath
        const result = await api.processVideos(selectedFiles)
        if (result.success) {
          setMessage(`Processed ${result.totalVideosProcessed} videos. Found ${result.combinedKeywordsArray.length} unique keywords.`)
          setStatus('success')
          setSelectedFiles([])
          onUploadComplete()
        } else {
          setMessage('Failed to process videos')
          setStatus('error')
        }
      } else {
        // Browser mode: upload and process
        const result = await api.uploadAndProcessVideos(browserFiles)
        if (result.success) {
          setMessage(`Processed ${result.totalVideosProcessed} videos. Found ${result.combinedKeywordsArray?.length || 0} unique keywords.`)
          setStatus('success')
          setSelectedFiles([])
          setBrowserFiles([])
          onUploadComplete()
        } else {
          setMessage('Failed to process videos')
          setStatus('error')
        }
      }
    } catch (error) {
      console.error('Processing error:', error)
      setMessage('Failed to process videos. Make sure the backend is running.')
      setStatus('error')
    } finally {
      setProcessing(false)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
    setBrowserFiles(files => files.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setSelectedFiles([])
    setBrowserFiles([])
    setStatus('idle')
    setMessage('')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Add Videos
          {!isElectron() && (
            <span className="text-xs font-normal text-muted-foreground ml-2">(Browser Mode)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden file input for browser mode */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*"
          onChange={handleBrowserFileChange}
          className="hidden"
        />

        {/* Select Files Button */}
        <Button
          variant="outline"
          className="w-full h-24 border-dashed"
          onClick={handleSelectFiles}
          disabled={uploading || processing}
        >
          <div className="flex flex-col items-center gap-2">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <span>Select Video Files</span>
          </div>
        </Button>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{selectedFiles.length} files selected</span>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedFiles.map((filepath, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileVideo className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {isElectron() ? filepath.split(/[/\\]/).pop() : filepath}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {selectedFiles.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleRegisterOnly}
              disabled={uploading || processing}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isElectron() ? 'Register Only' : 'Upload Only'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleProcessVideos}
              disabled={uploading || processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Process with AI
            </Button>
          </div>
        )}

        {/* Status Message */}
        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              status === 'success'
                ? 'bg-green-500/10 text-green-600'
                : status === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
