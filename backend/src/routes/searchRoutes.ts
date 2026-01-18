import { Router } from 'express'
import {
  semanticSearch,
  findSimilarKeywords,
  indexKeywords,
  getSearchStats,
  debugSearch
} from '../controllers/searchController'

const router = Router()

// Semantic search - finds files by matching query to keyword embeddings
// GET /api/search?q=<query>&topK=<number>&minSimilarity=<number>&type=<filetype>
router.get('/', semanticSearch)

// Find similar keywords without returning files
// GET /api/search/keywords?q=<query>&topK=<number>&minSimilarity=<number>
router.get('/keywords', findSimilarKeywords)

// Index all existing keywords (creates embeddings for search)
// POST /api/search/index
router.post('/index', indexKeywords)

// Get search statistics
// GET /api/search/stats
router.get('/stats', getSearchStats)

// Debug endpoint to check database content
// GET /api/search/debug
router.get('/debug', debugSearch)

export default router
