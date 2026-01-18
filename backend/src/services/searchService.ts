import db from '../db'
import EmbeddingService from './embeddingService'
import { FileModel, KeywordModel, MetadataModel, VideoFrameKeywordModel } from '../models/fileModel'

interface KeywordEmbedding {
  id: number
  keyword: string
  embedding: number[]
}

interface SearchResult {
  file_id: number
  filename: string
  filepath: string
  filetype: string
  size?: number
  mimetype?: string
  created_at?: string
  matchedKeywords: {
    keyword: string
    similarity: number
  }[]
  metadata?: Record<string, string>
  keywords?: string[]
  // Video-specific: frames where keywords matched
  matchedFrames?: {
    frame_index: number
    timestamp?: number
    keywords: string[]
  }[]
  // Audio-specific
  transcription?: string
  language?: string
  duration?: number
  // Document-specific
  summary?: string
  wordCount?: number
}

class SearchService {
  private static instance: SearchService
  private embeddingService: EmbeddingService

  private constructor() {
    this.embeddingService = EmbeddingService.getInstance()
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService()
    }
    return SearchService.instance
  }

  /**
   * Store embedding for a keyword in the database
   */
  async storeKeywordEmbedding(keyword: string): Promise<void> {
    // Check if already exists
    const existing = db.prepare('SELECT id FROM keyword_embeddings WHERE keyword = ?').get(keyword)
    if (existing) return

    const embedding = await this.embeddingService.generateEmbedding(keyword)
    const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer)

    db.prepare(`
      INSERT OR REPLACE INTO keyword_embeddings (keyword, embedding)
      VALUES (?, ?)
    `).run(keyword, embeddingBlob)
  }

  /**
   * Store embeddings for multiple keywords
   */
  async storeKeywordEmbeddings(keywords: string[]): Promise<void> {
    const uniqueKeywords = [...new Set(keywords.map(k => k.trim()).filter(k => k.length > 0))]
    
    for (const keyword of uniqueKeywords) {
      await this.storeKeywordEmbedding(keyword)
    }
  }

  /**
   * Get all stored keyword embeddings
   */
  getAllKeywordEmbeddings(): KeywordEmbedding[] {
    const rows = db.prepare('SELECT id, keyword, embedding FROM keyword_embeddings').all() as {
      id: number
      keyword: string
      embedding: Buffer
    }[]

    return rows.map(row => ({
      id: row.id,
      keyword: row.keyword,
      embedding: Array.from(new Float32Array(row.embedding.buffer.slice(
        row.embedding.byteOffset,
        row.embedding.byteOffset + row.embedding.byteLength
      )))
    }))
  }

  /**
   * Find top-K similar keywords to a query using embeddings
   */
  async findSimilarKeywords(
    query: string,
    topK: number = 10,
    minSimilarity: number = 0.3
  ): Promise<{ keyword: string; similarity: number }[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query)
    const allEmbeddings = this.getAllKeywordEmbeddings()

    if (allEmbeddings.length === 0) {
      return []
    }

    const similarities = allEmbeddings.map(item => ({
      keyword: item.keyword,
      similarity: this.embeddingService.calculateCosineSimilarity(queryEmbedding, item.embedding)
    }))

    return similarities
      .filter(s => s.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * Main semantic search function
   * Returns files that match the query based on keyword similarity
   */
  async semanticSearch(
    query: string,
    topK: number = 10,
    minSimilarity: number = 0.3,
    fileType?: string
  ): Promise<SearchResult[]> {
    console.log(`[Search] Query: "${query}", topK: ${topK}, minSimilarity: ${minSimilarity}`)

    // Find similar keywords from embeddings
    const similarKeywords = await this.findSimilarKeywords(query, topK * 2, minSimilarity)
    console.log(`[Search] Found ${similarKeywords.length} similar keywords:`, similarKeywords.slice(0, 5))

    // ALSO search for exact/partial keyword matches directly in the database
    // This handles cases where keywords aren't indexed yet
    const directMatches = this.findDirectKeywordMatches(query, fileType)
    console.log(`[Search] Found ${directMatches.size} files with direct keyword matches`)

    // Merge results - direct matches get high similarity
    const keywordSimilarityMap = new Map(similarKeywords.map(k => [k.keyword, k.similarity]))
    const matchedKeywordsList = similarKeywords.map(k => k.keyword)
    
    // Add query itself and partial matches with high similarity
    if (!keywordSimilarityMap.has(query.toLowerCase())) {
      keywordSimilarityMap.set(query.toLowerCase(), 1.0) // Exact match = 100%
      matchedKeywordsList.push(query.toLowerCase())
    }

    console.log(`[Search] Searching for keywords:`, matchedKeywordsList)

    // Find files that have these keywords (from semantic search)
    const fileKeywordMatches = this.findFilesWithKeywords(matchedKeywordsList, fileType)
    
    // Merge direct matches into file keyword matches
    for (const [fileId, keywords] of directMatches) {
      if (!fileKeywordMatches.has(fileId)) {
        fileKeywordMatches.set(fileId, [])
      }
      for (const kw of keywords) {
        const existing = fileKeywordMatches.get(fileId)!
        if (!existing.includes(kw)) {
          existing.push(kw)
          // Add to similarity map with high score for direct matches
          if (!keywordSimilarityMap.has(kw)) {
            keywordSimilarityMap.set(kw, 0.9) // Direct match = 90%
          }
        }
      }
    }

    console.log(`[Search] Found ${fileKeywordMatches.size} total files with matching keywords`)
    
    // Debug: log what files were found
    for (const [fileId, keywords] of fileKeywordMatches) {
      const file = FileModel.getById(fileId)
      console.log(`[Search] File ${fileId} (${file?.filetype}): ${file?.filename} - matched: ${keywords.join(', ')}`)
    }

    // Build search results
    const results: SearchResult[] = []

    for (const [fileId, matchedKeywords] of fileKeywordMatches) {
      const file = FileModel.getById(fileId)
      if (!file) continue

      // Get matched keywords with similarity scores
      const keywordsWithSimilarity = matchedKeywords.map(kw => ({
        keyword: kw,
        similarity: keywordSimilarityMap.get(kw) || 0
      })).sort((a, b) => b.similarity - a.similarity)

      const result: SearchResult = {
        file_id: fileId,
        filename: file.filename,
        filepath: file.filepath,
        filetype: file.filetype,
        size: file.size,
        mimetype: file.mimetype,
        created_at: file.created_at,
        matchedKeywords: keywordsWithSimilarity,
        keywords: KeywordModel.getByFileId(fileId)
      }

      // Get metadata
      const metadata = MetadataModel.getByFileId(fileId)
      if (metadata.length > 0) {
        result.metadata = {}
        for (const m of metadata) {
          result.metadata[m.key] = m.value
        }

        // Extract specific fields for different file types
        if (file.filetype === 'audio') {
          result.transcription = result.metadata['transcription']
          result.language = result.metadata['language']
          result.duration = result.metadata['duration'] ? parseFloat(result.metadata['duration']) : undefined
        }

        if (file.filetype === 'document' || file.filetype === 'text') {
          result.summary = result.metadata['summary']
          result.wordCount = result.metadata['word_count'] ? parseInt(result.metadata['word_count']) : undefined
        }
      }

      // For videos, get matching frames
      if (file.filetype === 'video') {
        result.matchedFrames = this.getMatchingFramesForVideo(fileId, matchedKeywords)
      }

      results.push(result)
    }

    // Sort by best matching keyword similarity
    results.sort((a, b) => {
      const aMax = a.matchedKeywords[0]?.similarity || 0
      const bMax = b.matchedKeywords[0]?.similarity || 0
      return bMax - aMax
    })

    return results.slice(0, topK)
  }

  /**
   * Find files that contain the query directly (exact or partial match)
   * This bypasses the embedding search for cases where keywords aren't indexed
   */
  private findDirectKeywordMatches(
    query: string,
    fileType?: string
  ): Map<number, string[]> {
    const fileKeywordMap = new Map<number, string[]>()
    const searchTerm = query.toLowerCase().trim()

    // Search file_keywords for exact or partial matches
    let fileKwQuery = `
      SELECT DISTINCT fk.file_id, fk.keyword, f.filetype
      FROM file_keywords fk
      JOIN files f ON f.id = fk.file_id
      WHERE LOWER(fk.keyword) LIKE ?
    `
    if (fileType) {
      fileKwQuery += ' AND f.filetype = ?'
    }

    const fileKwParams = fileType ? [`%${searchTerm}%`, fileType] : [`%${searchTerm}%`]
    const fileKwRows = db.prepare(fileKwQuery).all(...fileKwParams) as { file_id: number; keyword: string; filetype: string }[]

    console.log(`[Search] Direct file_keywords matches for "${searchTerm}": ${fileKwRows.length}`)

    for (const row of fileKwRows) {
      if (!fileKeywordMap.has(row.file_id)) {
        fileKeywordMap.set(row.file_id, [])
      }
      fileKeywordMap.get(row.file_id)!.push(row.keyword)
    }

    // Search video_frame_keywords for exact or partial matches
    let frameKwQuery = `
      SELECT DISTINCT vfk.file_id, vfk.keyword, f.filetype
      FROM video_frame_keywords vfk
      JOIN files f ON f.id = vfk.file_id
      WHERE LOWER(vfk.keyword) LIKE ?
    `
    if (fileType) {
      frameKwQuery += ' AND f.filetype = ?'
    }

    const frameKwParams = fileType ? [`%${searchTerm}%`, fileType] : [`%${searchTerm}%`]
    const frameKwRows = db.prepare(frameKwQuery).all(...frameKwParams) as { file_id: number; keyword: string; filetype: string }[]

    console.log(`[Search] Direct video_frame_keywords matches for "${searchTerm}": ${frameKwRows.length}`)

    for (const row of frameKwRows) {
      if (!fileKeywordMap.has(row.file_id)) {
        fileKeywordMap.set(row.file_id, [])
      }
      const existing = fileKeywordMap.get(row.file_id)!
      // Extract the matched keyword from the comma-separated string
      const keywords = row.keyword.split(',').map(k => k.trim().toLowerCase())
      for (const kw of keywords) {
        if (kw.includes(searchTerm) && !existing.includes(kw)) {
          existing.push(kw)
        }
      }
    }

    return fileKeywordMap
  }

  /**
   * Find files that contain any of the given keywords
   */
  private findFilesWithKeywords(
    keywords: string[],
    fileType?: string
  ): Map<number, string[]> {
    const fileKeywordMap = new Map<number, string[]>()

    if (keywords.length === 0) return fileKeywordMap

    // Debug: Check what's in the database
    const videoCount = (db.prepare('SELECT COUNT(*) as count FROM files WHERE filetype = ?').get('video') as { count: number }).count
    const videoFrameKwCount = (db.prepare('SELECT COUNT(*) as count FROM video_frame_keywords').get() as { count: number }).count
    const fileKwCount = (db.prepare('SELECT COUNT(*) as count FROM file_keywords').get() as { count: number }).count
    console.log(`[Search] DB stats: ${videoCount} videos, ${videoFrameKwCount} frame keywords, ${fileKwCount} file keywords`)

    // Search in file_keywords table (exact match)
    const placeholders = keywords.map(() => '?').join(',')
    let query = `
      SELECT DISTINCT fk.file_id, fk.keyword, f.filetype
      FROM file_keywords fk
      JOIN files f ON f.id = fk.file_id
      WHERE fk.keyword IN (${placeholders})
    `
    if (fileType) {
      query += ' AND f.filetype = ?'
    }

    const params = fileType ? [...keywords, fileType] : keywords
    const rows = db.prepare(query).all(...params) as { file_id: number; keyword: string; filetype: string }[]
    console.log(`[Search] file_keywords matches: ${rows.length}`, rows.slice(0, 3))

    for (const row of rows) {
      if (!fileKeywordMap.has(row.file_id)) {
        fileKeywordMap.set(row.file_id, [])
      }
      fileKeywordMap.get(row.file_id)!.push(row.keyword)
    }

    // Also search in video_frame_keywords table
    // Video frame keywords may be stored as comma-separated strings, so use LIKE
    for (const keyword of keywords) {
      // Use broader LIKE matching - case insensitive and anywhere in the string
      let videoQuery = `
        SELECT DISTINCT vfk.file_id, vfk.keyword, f.filetype
        FROM video_frame_keywords vfk
        JOIN files f ON f.id = vfk.file_id
        WHERE vfk.keyword LIKE ?
      `
      const videoParams: (string | undefined)[] = [
        `%${keyword}%`     // anywhere in the keyword string
      ]
      
      if (fileType) {
        videoQuery += ' AND f.filetype = ?'
        videoParams.push(fileType)
      }

      const videoRows = db.prepare(videoQuery).all(...videoParams) as { file_id: number; keyword: string }[]
      
      if (videoRows.length > 0) {
        console.log(`[Search] video_frame_keywords matches for "${keyword}": ${videoRows.length}`)
      }

      for (const row of videoRows) {
        if (!fileKeywordMap.has(row.file_id)) {
          fileKeywordMap.set(row.file_id, [])
        }
        const existing = fileKeywordMap.get(row.file_id)!
        if (!existing.includes(keyword)) {
          existing.push(keyword)
        }
      }
    }

    return fileKeywordMap
  }

  /**
   * Get matching frames for a video based on keywords
   */
  private getMatchingFramesForVideo(
    fileId: number,
    matchedKeywords: string[]
  ): { frame_index: number; timestamp?: number; keywords: string[] }[] {
    if (matchedKeywords.length === 0) return []

    // Video frame keywords may be stored as comma-separated strings
    // So we need to use LIKE to find matches
    const frameMap = new Map<number, { timestamp?: number; keywords: Set<string> }>()
    
    for (const keyword of matchedKeywords) {
      const rows = db.prepare(`
        SELECT frame_index, timestamp, keyword
        FROM video_frame_keywords
        WHERE file_id = ? AND (keyword = ? OR keyword LIKE ? OR keyword LIKE ? OR keyword LIKE ?)
        ORDER BY frame_index
      `).all(
        fileId,
        keyword,
        `${keyword},%`,
        `%, ${keyword},%`,
        `%, ${keyword}`
      ) as { frame_index: number; timestamp?: number; keyword: string }[]

      for (const row of rows) {
        if (!frameMap.has(row.frame_index)) {
          frameMap.set(row.frame_index, { timestamp: row.timestamp, keywords: new Set() })
        }
        frameMap.get(row.frame_index)!.keywords.add(keyword)
      }
    }

    return Array.from(frameMap.entries()).map(([frame_index, data]) => ({
      frame_index,
      timestamp: data.timestamp,
      keywords: Array.from(data.keywords)
    }))
  }

  /**
   * Index all existing keywords in the database
   * Call this on startup or after adding new files
   */
  async indexAllKeywords(): Promise<number> {
    console.log('[Search] Indexing all keywords...')

    // Get all unique keywords from file_keywords
    const fileKeywords = db.prepare('SELECT DISTINCT keyword FROM file_keywords').all() as { keyword: string }[]
    
    // Get all keywords from video_frame_keywords (may be comma-separated)
    const frameKeywordsRaw = db.prepare('SELECT DISTINCT keyword FROM video_frame_keywords').all() as { keyword: string }[]

    // Combine and deduplicate, splitting comma-separated frame keywords
    const allKeywords = new Set<string>()
    
    for (const k of fileKeywords) {
      allKeywords.add(k.keyword.trim())
    }
    
    for (const k of frameKeywordsRaw) {
      // Frame keywords may be comma-separated, split them
      const parts = k.keyword.split(',').map(p => p.trim()).filter(p => p.length > 0)
      for (const part of parts) {
        allKeywords.add(part)
      }
    }

    const keywordsArray = Array.from(allKeywords)
    console.log(`[Search] Found ${keywordsArray.length} unique keywords to index`)

    // Store embeddings for all keywords
    await this.storeKeywordEmbeddings(keywordsArray)

    console.log(`[Search] Indexed ${keywordsArray.length} keywords`)
    return keywordsArray.length
  }

  /**
   * Get embedding statistics
   */
  getStats(): { totalKeywords: number; indexedKeywords: number } {
    const fileKeywordsCount = (db.prepare('SELECT COUNT(DISTINCT keyword) as count FROM file_keywords').get() as { count: number }).count
    const frameKeywordsCount = (db.prepare('SELECT COUNT(DISTINCT keyword) as count FROM video_frame_keywords').get() as { count: number }).count
    const indexedCount = (db.prepare('SELECT COUNT(*) as count FROM keyword_embeddings').get() as { count: number }).count

    return {
      totalKeywords: fileKeywordsCount + frameKeywordsCount,
      indexedKeywords: indexedCount
    }
  }
}

export default SearchService
