import { Request, Response } from 'express'
import SearchService from '../services/searchService'

const searchService = SearchService.getInstance()

/**
 * Semantic search endpoint
 * GET /api/search?q=<query>&topK=<number>&minSimilarity=<number>&type=<filetype>
 */
export async function semanticSearch(req: Request, res: Response) {
  try {
    const { q, topK, minSimilarity, type } = req.query

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const k = topK ? parseInt(topK as string) : 10
    const similarity = minSimilarity ? parseFloat(minSimilarity as string) : 0.3
    const fileType = type as string | undefined

    if (isNaN(k) || k < 1 || k > 100) {
      return res.status(400).json({ error: 'topK must be a number between 1 and 100' })
    }

    if (isNaN(similarity) || similarity < 0 || similarity > 1) {
      return res.status(400).json({ error: 'minSimilarity must be a number between 0 and 1' })
    }

    console.log(`[SearchController] Search query: "${q}", topK: ${k}, minSimilarity: ${similarity}, type: ${fileType || 'all'}`)

    const results = await searchService.semanticSearch(q.trim(), k, similarity, fileType)

    res.json({
      success: true,
      query: q.trim(),
      topK: k,
      minSimilarity: similarity,
      fileType: fileType || 'all',
      count: results.length,
      results
    })
  } catch (error) {
    console.error('[SearchController] Semantic search error:', error)
    res.status(500).json({
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Find similar keywords endpoint
 * GET /api/search/keywords?q=<query>&topK=<number>&minSimilarity=<number>
 */
export async function findSimilarKeywords(req: Request, res: Response) {
  try {
    const { q, topK, minSimilarity } = req.query

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const k = topK ? parseInt(topK as string) : 10
    const similarity = minSimilarity ? parseFloat(minSimilarity as string) : 0.3

    const results = await searchService.findSimilarKeywords(q.trim(), k, similarity)

    res.json({
      success: true,
      query: q.trim(),
      count: results.length,
      keywords: results
    })
  } catch (error) {
    console.error('[SearchController] Find similar keywords error:', error)
    res.status(500).json({
      error: 'Failed to find similar keywords',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Index all keywords endpoint
 * POST /api/search/index
 */
export async function indexKeywords(req: Request, res: Response) {
  try {
    console.log('[SearchController] Indexing all keywords...')
    const count = await searchService.indexAllKeywords()

    res.json({
      success: true,
      message: `Indexed ${count} keywords`,
      indexedCount: count
    })
  } catch (error) {
    console.error('[SearchController] Index keywords error:', error)
    res.status(500).json({
      error: 'Failed to index keywords',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Get search stats endpoint
 * GET /api/search/stats
 */
export async function getSearchStats(req: Request, res: Response) {
  try {
    const stats = searchService.getStats()

    res.json({
      success: true,
      ...stats
    })
  } catch (error) {
    console.error('[SearchController] Get stats error:', error)
    res.status(500).json({
      error: 'Failed to get stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Debug endpoint to check database content
 * GET /api/search/debug
 */
export async function debugSearch(req: Request, res: Response) {
  try {
    const db = require('../db').default
    
    // Get all files grouped by type
    const files = db.prepare('SELECT id, filename, filetype FROM files').all()
    
    // Get sample keywords from file_keywords
    const fileKeywords = db.prepare('SELECT fk.file_id, fk.keyword, f.filetype FROM file_keywords fk JOIN files f ON f.id = fk.file_id LIMIT 20').all()
    
    // Get sample keywords from video_frame_keywords
    const frameKeywords = db.prepare('SELECT vfk.file_id, vfk.keyword, vfk.frame_index, f.filetype FROM video_frame_keywords vfk JOIN files f ON f.id = vfk.file_id LIMIT 20').all()
    
    // Get indexed keywords count
    const indexedCount = (db.prepare('SELECT COUNT(*) as count FROM keyword_embeddings').get() as { count: number }).count
    
    // Sample indexed keywords
    const indexedKeywords = db.prepare('SELECT keyword FROM keyword_embeddings LIMIT 20').all()
    
    res.json({
      success: true,
      files: {
        total: files.length,
        byType: files.reduce((acc: Record<string, number>, f: any) => {
          acc[f.filetype] = (acc[f.filetype] || 0) + 1
          return acc
        }, {}),
        sample: files.slice(0, 10)
      },
      fileKeywords: {
        sample: fileKeywords
      },
      frameKeywords: {
        sample: frameKeywords
      },
      indexedKeywords: {
        count: indexedCount,
        sample: indexedKeywords
      }
    })
  } catch (error) {
    console.error('[SearchController] Debug error:', error)
    res.status(500).json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
