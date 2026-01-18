import { Router } from 'express'
import { uploadImage } from '../middleware/upload'
import { 
  processLocalImages, 
  uploadAndProcessImages, 
  uploadImagesOnly,
  getImageAnalysis,
  analyzeImageById
} from '../controllers/imageController'

const router = Router()

// Process images from local filepaths (recommended for Electron - no file duplication)
router.post('/process', processLocalImages)

// Upload images only (for browser mode - copies files, no AI analysis)
router.post('/upload', uploadImage.array('images', 20), uploadImagesOnly)

// Upload and analyze images with AI (for browser mode - copies files)
router.post('/keywords', uploadImage.array('images', 20), uploadAndProcessImages)

// Get image analysis by ID
router.get('/:id/analysis', getImageAnalysis)

// Re-analyze an image by ID
router.post('/:id/analyze', analyzeImageById)

export default router
