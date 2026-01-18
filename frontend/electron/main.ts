import { app, BrowserWindow, ipcMain, dialog, session, protocol, net } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

// Register the custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'media', 
    privileges: { 
      secure: true, 
      supportFetchAPI: true, 
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    } 
  }
])

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local files via file:// protocol
    },
  })

  // Set Content Security Policy to allow connections to backend
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file: media:; " +
          "connect-src 'self' http://localhost:* ws://localhost:*; " +
          "media-src 'self' file: blob: media:; " +
          "img-src 'self' data: file: blob: https: media:;"
        ]
      }
    })
  })

  // In development, load from Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// IPC handler for opening file dialog
ipcMain.handle('dialog:openFiles', async (_event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: options?.filters || [
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result.filePaths
})

// IPC handler for opening folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.filePaths[0]
})

app.whenReady().then(() => {
  // Register custom protocol handler for local media files
  protocol.handle('media', async (request) => {
    try {
      // URL format: media://C:/path/to/file.mp4 or media://C/path/to/file.mp4
      let filePath = decodeURIComponent(request.url.replace('media://', ''))
      
      console.log('Media protocol - original URL:', request.url)
      console.log('Media protocol - decoded path:', filePath)
      
      // Fix Windows paths: if starts with single letter + slash, add colon
      // C/Users/... -> C:/Users/...
      if (filePath.match(/^[A-Za-z]\//)) {
        filePath = filePath.charAt(0) + ':' + filePath.substring(1)
        console.log('Media protocol - fixed path:', filePath)
      }
      
      // Handle leading slash before drive letter: /C:/... -> C:/...
      if (filePath.match(/^\/[A-Za-z]:/)) {
        filePath = filePath.substring(1)
      }
      
      // Check if file exists
      const fs = await import('fs')
      if (!fs.existsSync(filePath)) {
        console.error('Media protocol - file not found:', filePath)
        return new Response('File not found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
      
      // Use pathToFileURL for proper Windows path handling
      const fileUrl = pathToFileURL(filePath).href
      console.log('Media protocol - serving:', fileUrl)
      
      return net.fetch(fileUrl)
    } catch (error) {
      console.error('Media protocol error:', error)
      return new Response(`Error: ${error}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
