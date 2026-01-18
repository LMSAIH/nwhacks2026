// Type definitions for Electron API exposed via preload

export interface ElectronAPI {
  openFiles: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string[]>
  openFolder: () => Promise<string | undefined>
  send: (channel: string, data: unknown) => void
  receive: (channel: string, func: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
