import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Check if running in Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

// Get the correct URL for local files (media:// in Electron, file:// in browser)
export function getMediaUrl(filepath: string): string {
  const normalizedPath = filepath.replace(/\\/g, '/')
  // Use media:// protocol in Electron for better compatibility
  if (isElectron()) {
    return `media://${normalizedPath}`
  }
  // Fallback to file:// for browser (though this won't work in most cases)
  return `file://${normalizedPath}`
}
