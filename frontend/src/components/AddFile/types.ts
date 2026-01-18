import { FileVideo, FileImage, FileAudio, FileText, File } from 'lucide-react'

export type FileType = 'video' | 'image' | 'audio' | 'document' | 'all'

export type StatusType = { type: 'success' | 'error' | 'info'; message: string } | null

export interface FileTypeConfig {
  label: string
  icon: typeof FileVideo
  accept: string
  extensions: string[]
}

export const fileTypeConfig: Record<FileType, FileTypeConfig> = {
  video: {
    label: 'Videos',
    icon: FileVideo,
    accept: 'video/*',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm']
  },
  image: {
    label: 'Images',
    icon: FileImage,
    accept: 'image/*',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  },
  audio: {
    label: 'Audio',
    icon: FileAudio,
    accept: 'audio/*',
    extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a']
  },
  document: {
    label: 'Documents',
    icon: FileText,
    accept: '.txt,.md',
    extensions: ['txt', 'md']
  },
  all: {
    label: 'All Files',
    icon: File,
    accept: '*/*',
    extensions: ['*']
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI
}
