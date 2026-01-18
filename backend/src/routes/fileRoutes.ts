import { Router } from 'express'
import {
  getAllFiles,
  getFileById,
  createFile,
  registerFile,
  registerMultipleFiles,
  updateFile,
  deleteFile,
  searchFiles,
  setMetadata,
  addTag,
  removeTag,
  uploadFiles,
  toggleFavorite
} from '../controllers/fileController'
import { uploadVideo, uploadImage, uploadAudio, uploadDocument, uploadAny } from '../middleware/upload'

const router = Router()

// File CRUD
router.get('/', getAllFiles)
router.get('/search', searchFiles)
router.get('/:id', getFileById)
router.post('/', createFile)
router.post('/register', registerFile)
router.post('/register-multiple', registerMultipleFiles)
router.put('/:id', updateFile)
router.delete('/:id', deleteFile)

// Upload endpoints for different file types (browser mode)
router.post('/upload', uploadAny.array('files', 20), uploadFiles)
router.post('/upload/video', uploadVideo.array('files', 10), uploadFiles)
router.post('/upload/image', uploadImage.array('files', 20), uploadFiles)
router.post('/upload/audio', uploadAudio.array('files', 20), uploadFiles)
router.post('/upload/document', uploadDocument.array('files', 20), uploadFiles)

// Metadata
router.post('/:id/metadata', setMetadata)

// Tags
router.post('/:id/tags', addTag)
router.delete('/:id/tags/:tag', removeTag)

// Favorites
router.patch('/:id/favorite', toggleFavorite)

export default router
