import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { FileModel, MetadataModel, KeywordModel, VideoFrameKeywordModel, TagModel, FileRecord } from '../models/fileModel'

// Helper to get mimetype from extension
const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Helper to get filetype from mimetype
const getFileType = (mimetype: string): string => {
  if (mimetype.startsWith('video/')) return 'video'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('audio/')) return 'audio'
  if (mimetype === 'application/pdf') return 'document'
  if (mimetype.startsWith('text/')) return 'text'
  return 'other'
}

// Get all files
export const getAllFiles = (req: Request, res: Response) => {
  try {
    const { type } = req.query
    let files;
    if (type === 'notes') {
      // Notes includes both document (md) and text (txt) types
      files = FileModel.getByTypes(['document', 'text'])
    } else {
      files = type ? FileModel.getByType(type as string) : FileModel.getAll()
    }
    
    // Enrich files with metadata, keywords, and tags
    const enrichedFiles = files.map(file => {
      const metadata = MetadataModel.getByFileId(file.id!)
      const keywords = KeywordModel.getByFileId(file.id!)
      const tags = TagModel.getByFileId(file.id!)
      
      return {
        ...file,
        metadata: metadata.reduce((acc, m) => ({ ...acc, [m.key]: m.value }), {}),
        keywords,
        tags
      }
    })
    
    res.json({ success: true, files: enrichedFiles })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files', details: (error as Error).message })
  }
}

// Get file by ID with all metadata
export const getFileById = (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const file = FileModel.getById(Number(id))
    
    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const metadata = MetadataModel.getByFileId(Number(id))
    const keywords = KeywordModel.getByFileId(Number(id))
    const tags = TagModel.getByFileId(Number(id))

    // For videos, include frame-specific keyword mapping
    let frameKeywords = null
    let keywordFrameMap = null
    if (file.filetype === 'video') {
      frameKeywords = VideoFrameKeywordModel.getByFileId(Number(id))
      keywordFrameMap = VideoFrameKeywordModel.getKeywordFrameMap(Number(id))
    }

    res.json({
      success: true,
      file: {
        ...file,
        metadata: metadata.reduce((acc, m) => ({ ...acc, [m.key]: m.value }), {}),
        keywords,
        tags,
        // Video-specific: which frames each keyword appears in
        ...(file.filetype === 'video' && {
          frameKeywords,
          keywordFrameMap
        })
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file', details: (error as Error).message })
  }
}

// Create a new file record
export const createFile = (req: Request, res: Response) => {
  try {
    const { filename, filepath, filetype, size, mimetype, metadata, keywords, frameKeywords, tags } = req.body

    if (!filename || !filepath || !filetype) {
      res.status(400).json({ error: 'filename, filepath, and filetype are required' })
      return
    }

    // Check if file already exists
    const existing = FileModel.getByPath(filepath)
    if (existing) {
      res.status(409).json({ error: 'File already exists', file: existing })
      return
    }

    const file = FileModel.create({ filename, filepath, filetype, size, mimetype })

    // Add metadata if provided
    if (metadata && typeof metadata === 'object') {
      Object.entries(metadata).forEach(([key, value]) => {
        MetadataModel.set(file.id!, key, String(value))
      })
    }

    // Add general keywords (for all file types)
    if (keywords && Array.isArray(keywords)) {
      KeywordModel.addMany(file.id!, keywords)
    }

    // Add video frame-specific keywords (only for videos)
    if (filetype === 'video' && frameKeywords && Array.isArray(frameKeywords)) {
      VideoFrameKeywordModel.addMany(file.id!, frameKeywords)
    }

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => TagModel.add(file.id!, tag))
    }

    res.status(201).json({ success: true, file })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create file', details: (error as Error).message })
  }
}

// Register a file from local filesystem (no copying, just store reference)
export const registerFile = (req: Request, res: Response) => {
  try {
    const { filepath, tags, metadata } = req.body

    if (!filepath) {
      res.status(400).json({ error: 'filepath is required' })
      return
    }

    // Check if file exists on disk
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'File not found on disk', filepath })
      return
    }

    // Check if already registered
    const existing = FileModel.getByPath(filepath)
    if (existing) {
      res.status(409).json({ error: 'File already registered', file: existing })
      return
    }

    // Get file stats
    const stats = fs.statSync(filepath)
    const filename = path.basename(filepath)
    const mimetype = getMimeType(filepath)
    const filetype = getFileType(mimetype)

    // Create file record
    const file = FileModel.create({
      filename,
      filepath,
      filetype,
      size: stats.size,
      mimetype
    })

    // Add metadata if provided
    if (metadata && typeof metadata === 'object') {
      Object.entries(metadata).forEach(([key, value]) => {
        MetadataModel.set(file.id!, key, String(value))
      })
    }

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => TagModel.add(file.id!, tag))
    }

    res.status(201).json({ 
      success: true, 
      file: {
        ...file,
        metadata: metadata || {},
        tags: tags || []
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to register file', details: (error as Error).message })
  }
}

// Register multiple files at once
export const registerMultipleFiles = (req: Request, res: Response) => {
  try {
    const { filepaths, tags } = req.body

    if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
      res.status(400).json({ error: 'filepaths array is required' })
      return
    }

    const results: { success: any[]; failed: any[] } = { success: [], failed: [] }

    for (const filepath of filepaths) {
      // Check if file exists on disk
      if (!fs.existsSync(filepath)) {
        results.failed.push({ filepath, error: 'File not found on disk' })
        continue
      }

      // Check if already registered
      const existing = FileModel.getByPath(filepath)
      if (existing) {
        results.failed.push({ filepath, error: 'Already registered', file: existing })
        continue
      }

      // Get file stats
      const stats = fs.statSync(filepath)
      const filename = path.basename(filepath)
      const mimetype = getMimeType(filepath)
      const filetype = getFileType(mimetype)

      // Create file record
      const file = FileModel.create({
        filename,
        filepath,
        filetype,
        size: stats.size,
        mimetype
      })

      // Add tags if provided
      if (tags && Array.isArray(tags)) {
        tags.forEach(tag => TagModel.add(file.id!, tag))
      }

      results.success.push(file)
    }

    res.status(201).json({ 
      success: true, 
      registered: results.success.length,
      failed: results.failed.length,
      results
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to register files', details: (error as Error).message })
  }
}

// Update file
export const updateFile = (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { filename, filetype, size, mimetype, metadata, keywords, frameKeywords, tags } = req.body

    const file = FileModel.getById(Number(id))
    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    // Update file fields
    const updates: Partial<FileRecord> = {}
    if (filename) updates.filename = filename
    if (filetype) updates.filetype = filetype
    if (size !== undefined) updates.size = size
    if (mimetype) updates.mimetype = mimetype

    if (Object.keys(updates).length > 0) {
      FileModel.update(Number(id), updates)
    }

    // Update metadata if provided
    if (metadata && typeof metadata === 'object') {
      Object.entries(metadata).forEach(([key, value]) => {
        MetadataModel.set(Number(id), key, String(value))
      })
    }

    // Replace general keywords if provided
    if (keywords && Array.isArray(keywords)) {
      KeywordModel.deleteByFileId(Number(id))
      KeywordModel.addMany(Number(id), keywords)
    }

    // Replace video frame keywords if provided (only for videos)
    if (file.filetype === 'video' && frameKeywords && Array.isArray(frameKeywords)) {
      VideoFrameKeywordModel.deleteByFileId(Number(id))
      VideoFrameKeywordModel.addMany(Number(id), frameKeywords)
    }

    // Add tags if provided (doesn't remove existing)
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => TagModel.add(Number(id), tag))
    }

    res.json({ success: true, message: 'File updated' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update file', details: (error as Error).message })
  }
}

// Delete file
export const deleteFile = (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const deleted = FileModel.delete(Number(id))
    
    if (!deleted) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    res.json({ success: true, message: 'File deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file', details: (error as Error).message })
  }
}

// Search files
export const searchFiles = (req: Request, res: Response) => {
  try {
    const { q, keyword, tag, includeFrames } = req.query

    let fileIds: number[] | null = null

    // Search by keyword (searches both general keywords and video frame keywords)
    if (keyword) {
      // Search in general keywords (returns file_id array directly)
      const generalFileIds = KeywordModel.searchByKeyword(keyword as string)
      
      // Search in video frame keywords
      const frameResults = VideoFrameKeywordModel.searchByKeyword(keyword as string)
      const frameFileIds = frameResults.map(r => r.file_id)
      
      // Combine and deduplicate
      fileIds = [...new Set([...generalFileIds, ...frameFileIds])]
    }

    // Search by tag
    if (tag) {
      const tagFileIds = TagModel.getFilesByTag(tag as string)
      fileIds = fileIds ? fileIds.filter(id => tagFileIds.includes(id)) : tagFileIds
    }

    // Search by filename
    let files: FileRecord[]
    if (q) {
      files = FileModel.search(q as string)
      if (fileIds) {
        files = files.filter(f => fileIds!.includes(f.id!))
      }
    } else if (fileIds) {
      files = fileIds.map(id => FileModel.getById(id)!).filter(Boolean)
    } else {
      files = FileModel.getAll()
    }

    // Optionally include frame data for videos when searching by keyword
    const results = files.map(file => {
      if (file.filetype === 'video' && keyword && includeFrames === 'true') {
        const frameResults = VideoFrameKeywordModel.getFramesByKeyword(file.id!, keyword as string)
        return { ...file, matchingFrames: frameResults }
      }
      return file
    })

    res.json({ success: true, files: results })
  } catch (error) {
    res.status(500).json({ error: 'Failed to search files', details: (error as Error).message })
  }
}

// Add/update metadata
export const setMetadata = (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { key, value } = req.body

    if (!key || value === undefined) {
      res.status(400).json({ error: 'key and value are required' })
      return
    }

    const file = FileModel.getById(Number(id))
    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    MetadataModel.set(Number(id), key, String(value))
    res.json({ success: true, message: 'Metadata set' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to set metadata', details: (error as Error).message })
  }
}

// Add tag
export const addTag = (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { tag } = req.body

    if (!tag) {
      res.status(400).json({ error: 'tag is required' })
      return
    }

    const file = FileModel.getById(Number(id))
    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    TagModel.add(Number(id), tag)
    res.json({ success: true, message: 'Tag added' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tag', details: (error as Error).message })
  }
}

// Remove tag
export const removeTag = (req: Request, res: Response) => {
  try {
    const { id, tag } = req.params

    const deleted = TagModel.delete(Number(id), tag)
    if (!deleted) {
      res.status(404).json({ error: 'Tag not found' })
      return
    }

    res.json({ success: true, message: 'Tag removed' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove tag', details: (error as Error).message })
  }
}

// Upload files (browser mode - copies files to uploads directory)
export const uploadFiles = (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[]
    
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' })
      return
    }

    const results: { success: any[]; failed: any[] } = { success: [], failed: [] }

    for (const file of files) {
      const mimetype = file.mimetype
      const filetype = getFileType(mimetype)
      
      // Check if already registered
      const existing = FileModel.getByPath(file.path)
      if (existing) {
        results.failed.push({ filepath: file.path, error: 'Already registered', file: existing })
        continue
      }

      // Create file record
      const fileRecord = FileModel.create({
        filename: file.originalname,
        filepath: file.path,
        filetype,
        size: file.size,
        mimetype
      })

      results.success.push(fileRecord)
    }

    res.status(201).json({
      success: true,
      files: results.success,
      registered: results.success.length,
      failed: results.failed.length,
      results
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload files', details: (error as Error).message })
  }
}
