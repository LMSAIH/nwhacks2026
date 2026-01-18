import { Router } from 'express'
import { upload } from '../middleware/upload'
import { extractKeywords, processLocalVideos, uploadOnly } from '../controllers/videoController'

const router = Router()

// Process videos from local filepaths (recommended for Electron - no file duplication)
router.post('/process', processLocalVideos)

// Upload videos only (for browser mode - copies files)
router.post('/upload', upload.array('videos', 10), uploadOnly)

// Upload and process videos with AI (for browser mode - copies files)
router.post('/keywords', upload.array('videos', 10), extractKeywords)

export default router
