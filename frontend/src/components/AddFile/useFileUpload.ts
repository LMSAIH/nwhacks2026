import { useState, useRef, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { FileType, StatusType } from './types'
import { fileTypeConfig, isElectron } from './types'

interface UseFileUploadOptions {
  onComplete: () => void
}

// Helper to get file extension
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

// Helper to detect actual file type from files
function detectFileType(
  selectedType: FileType | null,
  filenames: string[]
): 'video' | 'audio' | 'document' | 'image' | null {
  if (selectedType && selectedType !== 'all') {
    return selectedType
  }

  if (filenames.length === 0) return null

  const ext = getFileExtension(filenames[0])
  
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) return 'audio'
  if (['txt', 'md'].includes(ext)) return 'document'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  
  return null
}

export function useFileUpload({ onComplete }: UseFileUploadOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<FileType | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [browserFiles, setBrowserFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusType>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Use refs to always have current values in async functions
  const browserFilesRef = useRef<File[]>([])
  const selectedFilesRef = useRef<string[]>([])
  const selectedTypeRef = useRef<FileType | null>(null)
  
  // Keep refs in sync with state
  useEffect(() => { browserFilesRef.current = browserFiles }, [browserFiles])
  useEffect(() => { selectedFilesRef.current = selectedFiles }, [selectedFiles])
  useEffect(() => { selectedTypeRef.current = selectedType }, [selectedType])

  const resetAndClose = useCallback(() => {
    setIsOpen(false)
    setSelectedType(null)
    setSelectedFiles([])
    setBrowserFiles([])
    setStatus(null)
  }, [])

  const handleSelectType = useCallback(async (type: FileType) => {
    setSelectedType(type)
    setStatus(null)
    
    if (isElectron()) {
      try {
        const config = fileTypeConfig[type]
        const files = await window.electronAPI!.openFiles({
          filters: [{ name: config.label, extensions: config.extensions }]
        })
        if (files && files.length > 0) {
          setSelectedFiles(files)
        } else {
          setSelectedType(null)
        }
      } catch (error) {
        console.error('Failed to open file dialog:', error)
        setStatus({ type: 'error', message: 'Failed to open file dialog' })
      }
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.accept = fileTypeConfig[type].accept
        fileInputRef.current.click()
      }
    }
  }, [])

  const handleBrowserFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileArray = Array.from(files)
      setBrowserFiles(fileArray)
      setSelectedFiles(fileArray.map(f => f.name))
    }
    e.target.value = ''
  }, [])

  const handleUploadOnly = async () => {
    const files = selectedFilesRef.current
    const bFiles = browserFilesRef.current
    const type = selectedTypeRef.current
    
    console.log('handleUploadOnly - files:', files, 'browserFiles:', bFiles)
    
    if (files.length === 0) return
    
    setLoading(true)
    setStatus({ type: 'info', message: 'Uploading files...' })

    try {
      if (isElectron()) {
        const result = await api.registerMultipleFiles(files)
        if (result.success) {
          setStatus({ type: 'success', message: `Added ${result.registered} files` })
          setTimeout(() => { resetAndClose(); onComplete() }, 1000)
        } else {
          setStatus({ type: 'error', message: 'Failed to add files' })
        }
      } else {
        const apiFileType = type === 'all' ? undefined : 
                           type === 'document' ? 'document' : 
                           type as 'video' | 'image' | 'audio' | 'document' | undefined
        const result = await api.uploadFiles(bFiles, apiFileType)
        if (result.success) {
          setStatus({ type: 'success', message: `Uploaded ${result.registered || result.files?.length || 0} files` })
          setTimeout(() => { resetAndClose(); onComplete() }, 1000)
        } else {
          setStatus({ type: 'error', message: 'Failed to upload files' })
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      setStatus({ type: 'error', message: 'Failed to upload. Is the backend running?' })
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeWithAI = async () => {
    const files = selectedFilesRef.current
    const bFiles = browserFilesRef.current
    const type = selectedTypeRef.current
    
    console.log('handleAnalyzeWithAI - files:', files, 'browserFiles:', bFiles, 'type:', type)
    
    if (files.length === 0) {
      setStatus({ type: 'error', message: 'No files selected' })
      return
    }
    
    const detectedType = detectFileType(type, files)
    console.log('Detected type:', detectedType)
    
    if (!detectedType) {
      setStatus({ type: 'error', message: 'Could not detect file type for analysis' })
      return
    }

    setLoading(true)
    setStatus({ type: 'info', message: `Analyzing ${detectedType} with AI... This may take a while.` })

    try {
      // DOCUMENTS
      if (detectedType === 'document') {
        if (isElectron()) {
          const result = await api.processDocuments(files)
          if (result.success) {
            const totalKeywords = result.results.reduce((acc, r) => acc + r.keywords.length, 0)
            setStatus({ type: 'success', message: `Analyzed ${result.processed} documents. Found ${totalKeywords} keywords.` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze documents' })
          }
        } else {
          const result = await api.uploadAndProcessDocuments(bFiles)
          if (result.success) {
            setStatus({ type: 'success', message: `Analyzed ${result.processed} documents` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze documents' })
          }
        }
      }
      // AUDIO
      else if (detectedType === 'audio') {
        if (isElectron()) {
          const result = await api.processAudio(files)
          if (result.success) {
            setStatus({ type: 'success', message: `Analyzed ${result.totalAudioProcessed} audio files.` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze audio' })
          }
        } else {
          const result = await api.uploadAndProcessAudio(bFiles)
          if (result.success) {
            setStatus({ type: 'success', message: `Analyzed ${result.totalAudioProcessed} audio files` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze audio' })
          }
        }
      }
      // VIDEO
      else if (detectedType === 'video') {
        if (isElectron()) {
          const result = await api.processVideos(files)
          if (result.success) {
            setStatus({ type: 'success', message: `Analyzed ${result.totalVideosProcessed} videos.` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze videos' })
          }
        } else {
          const result = await api.uploadAndProcessVideos(bFiles)
          if (result.success) {
            setStatus({ type: 'success', message: `Analyzed ${result.totalVideosProcessed} videos` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze videos' })
          }
        }
      }
      // IMAGES
      else if (detectedType === 'image') {
        if (isElectron()) {
          const result = await api.processImages(files)
          if (result.success) {
            const totalKeywords = result.results?.reduce((acc, r) => acc + (r.keywords?.length || 0), 0) || 0
            setStatus({ type: 'success', message: `Analyzed ${result.processed} images. Found ${totalKeywords} keywords.` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze images' })
          }
        } else {
          console.log('Browser mode - uploading images:', bFiles)
          const result = await api.uploadAndProcessImages(bFiles)
          console.log('Upload result:', result)
          if (result.success) {
            const totalKeywords = result.results?.reduce((acc, r) => acc + (r.keywords?.length || 0), 0) || 0
            setStatus({ type: 'success', message: `Analyzed ${result.processed} images. Found ${totalKeywords} keywords.` })
            setTimeout(() => { resetAndClose(); onComplete() }, 1500)
          } else {
            setStatus({ type: 'error', message: 'Failed to analyze images' })
          }
        }
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setStatus({ type: 'error', message: 'Failed to analyze. Is the backend running?' })
    } finally {
      setLoading(false)
    }
  }

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
    setBrowserFiles(files => files.filter((_, i) => i !== index))
  }, [])

  const goBack = useCallback(() => {
    setSelectedType(null)
    setSelectedFiles([])
    setBrowserFiles([])
    setStatus(null)
  }, [])

  return {
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
  }
}
