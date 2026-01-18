import { Router } from 'express'
import { uploadAudio } from '../middleware/upload'
import { extractAudioKeywords, processLocalAudio, uploadAudioOnly } from '../controllers/audioController'

const router = Router()

// Process audio from local filepaths (recommended for Electron - no file duplication)
router.post('/process', processLocalAudio)

// Upload audio only (for browser mode - copies files)
router.post('/upload', uploadAudio.array('audio', 10), uploadAudioOnly)

// Upload and process audio with AI (for browser mode - copies files)
router.post('/keywords', uploadAudio.array('audio', 10), extractAudioKeywords)

export default router
