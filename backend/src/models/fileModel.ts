import db from '../db'

export interface FileRecord {
  id?: number
  filename: string
  filepath: string
  filetype: string
  size?: number
  mimetype?: string
  is_favorite?: boolean
  created_at?: string
  updated_at?: string
}

export interface FileMetadata {
  id?: number
  file_id: number
  key: string
  value: string
}

export interface FileKeyword {
  id?: number
  file_id: number
  keyword: string
}

export interface VideoFrameKeyword {
  id?: number
  file_id: number
  keyword: string
  frame_index: number
  timestamp?: number
  confidence?: number
}

export interface FileTag {
  id?: number
  file_id: number
  tag: string
}

export const FileModel = {
  // Create a new file record
  create(file: FileRecord): FileRecord {
    const stmt = db.prepare(`
      INSERT INTO files (filename, filepath, filetype, size, mimetype)
      VALUES (@filename, @filepath, @filetype, @size, @mimetype)
    `)
    const result = stmt.run(file)
    return { ...file, id: result.lastInsertRowid as number }
  },

  // Get file by ID
  getById(id: number): FileRecord | undefined {
    const stmt = db.prepare('SELECT * FROM files WHERE id = ?')
    return stmt.get(id) as FileRecord | undefined
  },

  // Get file by filepath
  getByPath(filepath: string): FileRecord | undefined {
    const stmt = db.prepare('SELECT * FROM files WHERE filepath = ?')
    return stmt.get(filepath) as FileRecord | undefined
  },

  // Get all files
  getAll(): FileRecord[] {
    const stmt = db.prepare('SELECT * FROM files ORDER BY created_at DESC')
    return stmt.all() as FileRecord[]
  },

  // Get files by type
  getByType(filetype: string): FileRecord[] {
    const stmt = db.prepare('SELECT * FROM files WHERE filetype = ? ORDER BY created_at DESC')
    return stmt.all(filetype) as FileRecord[]
  },

  // Get files by multiple types (e.g., for 'notes' which includes document and text)
  getByTypes(filetypes: string[]): FileRecord[] {
    const placeholders = filetypes.map(() => '?').join(', ')
    const stmt = db.prepare(`SELECT * FROM files WHERE filetype IN (${placeholders}) ORDER BY created_at DESC`)
    return stmt.all(...filetypes) as FileRecord[]
  },

  // Update file
  update(id: number, updates: Partial<FileRecord>): boolean {
    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map(k => `${k} = @${k}`)
      .join(', ')
    
    if (!fields) return false

    const stmt = db.prepare(`
      UPDATE files SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id
    `)
    const result = stmt.run({ ...updates, id })
    return result.changes > 0
  },

  // Delete file
  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM files WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  // Search files by filename
  search(query: string): FileRecord[] {
    const stmt = db.prepare('SELECT * FROM files WHERE filename LIKE ? ORDER BY created_at DESC')
    return stmt.all(`%${query}%`) as FileRecord[]
  },

  // Toggle favorite status
  toggleFavorite(id: number): { is_favorite: boolean } | null {
    const file = this.getById(id)
    if (!file) return null
    
    const newValue = file.is_favorite ? 0 : 1
    const stmt = db.prepare('UPDATE files SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    stmt.run(newValue, id)
    
    return { is_favorite: newValue === 1 }
  },

  // Get favorite files
  getFavorites(): FileRecord[] {
    const stmt = db.prepare('SELECT * FROM files WHERE is_favorite = 1 ORDER BY created_at DESC')
    return stmt.all() as FileRecord[]
  }
}

export const MetadataModel = {
  // Set metadata (upsert)
  set(file_id: number, key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT INTO file_metadata (file_id, key, value)
      VALUES (@file_id, @key, @value)
      ON CONFLICT(file_id, key) DO UPDATE SET value = @value
    `)
    stmt.run({ file_id, key, value })
  },

  // Get all metadata for a file
  getByFileId(file_id: number): FileMetadata[] {
    const stmt = db.prepare('SELECT * FROM file_metadata WHERE file_id = ?')
    return stmt.all(file_id) as FileMetadata[]
  },

  // Get specific metadata
  get(file_id: number, key: string): FileMetadata | undefined {
    const stmt = db.prepare('SELECT * FROM file_metadata WHERE file_id = ? AND key = ?')
    return stmt.get(file_id, key) as FileMetadata | undefined
  },

  // Delete metadata
  delete(file_id: number, key: string): boolean {
    const stmt = db.prepare('DELETE FROM file_metadata WHERE file_id = ? AND key = ?')
    const result = stmt.run(file_id, key)
    return result.changes > 0
  }
}

// General keywords for all file types
export const KeywordModel = {
  // Add keyword (upsert)
  add(file_id: number, keyword: string): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO file_keywords (file_id, keyword) VALUES (?, ?)
    `)
    stmt.run(file_id, keyword)
  },

  // Add multiple keywords
  addMany(file_id: number, keywords: string[]): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO file_keywords (file_id, keyword) VALUES (?, ?)
    `)
    
    const insertMany = db.transaction((items: string[]) => {
      for (const keyword of items) {
        stmt.run(file_id, keyword)
      }
    })
    
    insertMany(keywords)
  },

  // Get keywords for a file
  getByFileId(file_id: number): string[] {
    const stmt = db.prepare('SELECT keyword FROM file_keywords WHERE file_id = ?')
    return (stmt.all(file_id) as { keyword: string }[]).map(r => r.keyword)
  },

  // Search files by keyword
  searchByKeyword(keyword: string): number[] {
    const stmt = db.prepare('SELECT DISTINCT file_id FROM file_keywords WHERE keyword LIKE ?')
    return (stmt.all(`%${keyword}%`) as { file_id: number }[]).map(r => r.file_id)
  },

  // Delete all keywords for a file
  deleteByFileId(file_id: number): boolean {
    const stmt = db.prepare('DELETE FROM file_keywords WHERE file_id = ?')
    const result = stmt.run(file_id)
    return result.changes > 0
  },

  // Delete specific keyword
  delete(file_id: number, keyword: string): boolean {
    const stmt = db.prepare('DELETE FROM file_keywords WHERE file_id = ? AND keyword = ?')
    const result = stmt.run(file_id, keyword)
    return result.changes > 0
  }
}

// Video-specific frame keywords
export const VideoFrameKeywordModel = {
  // Add frame keywords for a video
  addMany(file_id: number, frameKeywords: { keyword: string; frame_index: number; timestamp?: number; confidence?: number }[]): void {
    const stmt = db.prepare(`
      INSERT INTO video_frame_keywords (file_id, keyword, frame_index, timestamp, confidence)
      VALUES (@file_id, @keyword, @frame_index, @timestamp, @confidence)
    `)
    
    const insertMany = db.transaction((items: typeof frameKeywords) => {
      for (const item of items) {
        stmt.run({ file_id, keyword: item.keyword, frame_index: item.frame_index, timestamp: item.timestamp ?? null, confidence: item.confidence ?? null })
      }
    })
    
    insertMany(frameKeywords)
  },

  // Get all frame keywords for a video
  getByFileId(file_id: number): VideoFrameKeyword[] {
    const stmt = db.prepare('SELECT * FROM video_frame_keywords WHERE file_id = ? ORDER BY frame_index')
    return stmt.all(file_id) as VideoFrameKeyword[]
  },

  // Get keywords for a specific frame
  getByFrame(file_id: number, frame_index: number): VideoFrameKeyword[] {
    const stmt = db.prepare('SELECT * FROM video_frame_keywords WHERE file_id = ? AND frame_index = ?')
    return stmt.all(file_id, frame_index) as VideoFrameKeyword[]
  },

  // Get all frames that contain a specific keyword
  getFramesByKeyword(file_id: number, keyword: string): VideoFrameKeyword[] {
    const stmt = db.prepare('SELECT * FROM video_frame_keywords WHERE file_id = ? AND keyword LIKE ? ORDER BY frame_index')
    return stmt.all(file_id, `%${keyword}%`) as VideoFrameKeyword[]
  },

  // Search videos by keyword (returns file_ids and their matching frames)
  searchByKeyword(keyword: string): { file_id: number; frame_index: number; timestamp?: number }[] {
    const stmt = db.prepare(`
      SELECT DISTINCT file_id, frame_index, timestamp 
      FROM video_frame_keywords 
      WHERE keyword LIKE ? 
      ORDER BY file_id, frame_index
    `)
    return stmt.all(`%${keyword}%`) as { file_id: number; frame_index: number; timestamp?: number }[]
  },

  // Get unique keywords for a video
  getUniqueKeywords(file_id: number): string[] {
    const stmt = db.prepare('SELECT DISTINCT keyword FROM video_frame_keywords WHERE file_id = ?')
    return (stmt.all(file_id) as { keyword: string }[]).map(r => r.keyword)
  },

  // Get keyword to frames mapping for a video
  getKeywordFrameMap(file_id: number): Record<string, { frame_index: number; timestamp?: number }[]> {
    const stmt = db.prepare('SELECT keyword, frame_index, timestamp FROM video_frame_keywords WHERE file_id = ? ORDER BY keyword, frame_index')
    const rows = stmt.all(file_id) as { keyword: string; frame_index: number; timestamp?: number }[]
    
    const map: Record<string, { frame_index: number; timestamp?: number }[]> = {}
    for (const row of rows) {
      if (!map[row.keyword]) {
        map[row.keyword] = []
      }
      map[row.keyword].push({ frame_index: row.frame_index, timestamp: row.timestamp })
    }
    return map
  },

  // Delete all frame keywords for a video
  deleteByFileId(file_id: number): boolean {
    const stmt = db.prepare('DELETE FROM video_frame_keywords WHERE file_id = ?')
    const result = stmt.run(file_id)
    return result.changes > 0
  }
}

export const TagModel = {
  // Add tag
  add(file_id: number, tag: string): void {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)
    `)
    stmt.run(file_id, tag)
  },

  // Get tags for a file
  getByFileId(file_id: number): string[] {
    const stmt = db.prepare('SELECT tag FROM file_tags WHERE file_id = ?')
    return (stmt.all(file_id) as { tag: string }[]).map(r => r.tag)
  },

  // Get files by tag
  getFilesByTag(tag: string): number[] {
    const stmt = db.prepare('SELECT file_id FROM file_tags WHERE tag = ?')
    return (stmt.all(tag) as { file_id: number }[]).map(r => r.file_id)
  },

  // Delete tag
  delete(file_id: number, tag: string): boolean {
    const stmt = db.prepare('DELETE FROM file_tags WHERE file_id = ? AND tag = ?')
    const result = stmt.run(file_id, tag)
    return result.changes > 0
  }
}
