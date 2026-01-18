import multer from 'multer'
import path from 'path'
import fs from 'fs'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

// Video-only upload (for AI processing)
export const uploadVideo = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm/
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    if (ext || file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
})

// Image-only upload
export const uploadImage = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|gif|webp|svg|bmp|ico/
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    if (ext || file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
})

// Audio-only upload
export const uploadAudio = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|ogg|flac|m4a|aac|wma/
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    if (ext || file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Only audio files are allowed'))
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
})

// Document upload (txt and md only)
export const uploadDocument = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /txt|md/
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    if (ext || 
        file.mimetype === 'text/plain' ||
        file.mimetype === 'text/markdown') {
      cb(null, true)
    } else {
      cb(new Error('Only .txt and .md files are allowed'))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
})

// General upload - accepts all file types
export const uploadAny = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
})

// Legacy export for backward compatibility
export const upload = uploadVideo
