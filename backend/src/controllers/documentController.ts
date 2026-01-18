import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  FileModel,
  KeywordModel,
  MetadataModel,
} from "../models/fileModel";
import SearchService from "../services/searchService";

const searchService = SearchService.getInstance();
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Get uploads directory path
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

interface DocumentAnalysisResult {
  filepath: string;
  filename: string;
  content: string;
  summary: string;
  keywords: string[];
  wordCount: number;
  characterCount: number;
}

// Helper to determine file type from extension
function getDocumentType(filepath: string): 'text' | 'markdown' | 'unknown' {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.txt') return 'text';
  if (ext === '.md') return 'markdown';
  return 'unknown';
}

// Read text content from file
function readTextFile(filepath: string): string {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
  return fs.readFileSync(filepath, 'utf-8');
}

// Call Gemini via OpenRouter for text analysis
async function analyzeWithGemini(content: string, task: 'keywords' | 'summary' | 'both'): Promise<{ keywords?: string[]; summary?: string }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPEN_ROUTER_KEY is not set in environment variables");
  }

  let systemPrompt = "";
  
  if (task === 'keywords' || task === 'both') {
    systemPrompt = `You are a document analysis assistant. Analyze the given text and extract the most important keywords and key phrases.

Return your response as a JSON object with this structure:
{
  "keywords": ["keyword1", "keyword2", ...],
  "summary": "A brief 2-3 sentence summary of the document content"
}

For keywords:
- Extract 10-20 most relevant keywords/phrases
- Include main topics, important concepts, names, and technical terms
- Order by relevance

For summary:
- Provide a concise 2-3 sentence summary
- Capture the main purpose and key points of the document`;
  } else if (task === 'summary') {
    systemPrompt = `Provide a brief 2-3 sentence summary of the following text. Return ONLY the summary text, nothing else.`;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Omni Document Analyzer"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content.slice(0, 30000) } // Limit content to avoid token limits
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const responseText = data.choices?.[0]?.message?.content || "";

  // Parse JSON response
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        keywords: parsed.keywords || [],
        summary: parsed.summary || ""
      };
    }
  } catch (e) {
    // If JSON parsing fails, treat as plain text summary
    console.warn("Failed to parse JSON response, using as plain text");
  }

  return {
    keywords: [],
    summary: responseText.trim()
  };
}

// Create a new document file
export async function createNewDocument(req: Request, res: Response) {
  try {
    const { filename, content = '', fileType = 'md' } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "filename is required" });
    }

    // Sanitize filename and ensure proper extension
    let sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '').trim();
    
    // Add extension if not present
    const ext = fileType === 'txt' ? '.txt' : '.md';
    if (!sanitizedFilename.endsWith(ext)) {
      sanitizedFilename = sanitizedFilename.replace(/\.(md|txt)$/i, '') + ext;
    }

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Generate unique filename if file already exists
    let finalFilename = sanitizedFilename;
    let filepath = path.join(UPLOADS_DIR, finalFilename);
    let counter = 1;
    
    while (fs.existsSync(filepath)) {
      const nameWithoutExt = sanitizedFilename.replace(/\.(md|txt)$/i, '');
      finalFilename = `${nameWithoutExt} (${counter})${ext}`;
      filepath = path.join(UPLOADS_DIR, finalFilename);
      counter++;
    }

    // Write the file
    fs.writeFileSync(filepath, content, 'utf-8');

    // Determine file type for database
    const docType = getDocumentType(filepath);
    const dbFileType = docType === 'markdown' ? 'document' : 'text';

    // Create database record
    const fileRecord = FileModel.create({
      filename: finalFilename,
      filepath: filepath,
      filetype: dbFileType,
      size: Buffer.byteLength(content, 'utf-8'),
      mimetype: fileType === 'txt' ? 'text/plain' : 'text/markdown',
    });

    // Set initial metadata
    const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
    const characterCount = content.length;
    MetadataModel.set(fileRecord.id!, 'word_count', wordCount.toString());
    MetadataModel.set(fileRecord.id!, 'character_count', characterCount.toString());
    MetadataModel.set(fileRecord.id!, 'document_type', docType);

    res.status(201).json({
      success: true,
      file: fileRecord,
      wordCount,
      characterCount
    });

  } catch (error) {
    console.error("Create document error:", error);
    res.status(500).json({
      error: "Failed to create document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Process document from local filepath (for Electron - no file duplication)
export async function processLocalDocument(req: Request, res: Response) {
  try {
    const { filepaths } = req.body;

    if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
      return res.status(400).json({ error: "filepaths array is required" });
    }

    const results: DocumentAnalysisResult[] = [];
    const errors: { filepath: string; error: string }[] = [];

    for (const filepath of filepaths) {
      try {
        // Validate file type
        const docType = getDocumentType(filepath);
        if (docType === 'unknown') {
          errors.push({ filepath, error: "Unsupported file type. Only .txt and .md files are supported." });
          continue;
        }

        // Read file content
        const content = readTextFile(filepath);
        const filename = path.basename(filepath);
        const stats = fs.statSync(filepath);

        // Analyze with Gemini
        const analysis = await analyzeWithGemini(content, 'both');

        // Check if file already exists in DB
        let fileRecord = FileModel.getByPath(filepath);

        if (!fileRecord) {
          // Create new file record
          fileRecord = FileModel.create({
            filename,
            filepath,
            filetype: docType === 'markdown' ? 'document' : 'text',
            size: stats.size,
            mimetype: docType === 'markdown' ? 'text/markdown' : 'text/plain',
          });
        }

        const fileId = fileRecord.id!;

        // Clear existing keywords and metadata
        KeywordModel.deleteByFileId(fileId);

        // Save keywords
        if (analysis.keywords && analysis.keywords.length > 0) {
          KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
          
          // Index keywords for semantic search (run in background)
          searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
            console.error('Failed to index document keywords:', err);
          });
        }

        // Save metadata
        MetadataModel.set(fileId, 'summary', analysis.summary || '');
        MetadataModel.set(fileId, 'word_count', content.split(/\s+/).filter(w => w.length > 0).length.toString());
        MetadataModel.set(fileId, 'character_count', content.length.toString());
        MetadataModel.set(fileId, 'document_type', docType);

        results.push({
          filepath,
          filename,
          content: content.slice(0, 1000) + (content.length > 1000 ? '...' : ''), // Preview only
          summary: analysis.summary || '',
          keywords: analysis.keywords || [],
          wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
          characterCount: content.length
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({ filepath, error: errorMessage });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("Document processing error:", error);
    res.status(500).json({
      error: "Failed to process documents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Upload document only (for browser mode - copies files)
export async function uploadDocumentOnly(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No document files uploaded" });
    }

    const results = [];

    for (const file of files) {
      // Validate file type
      const docType = getDocumentType(file.originalname);
      if (docType === 'unknown') {
        continue; // Skip unsupported files
      }

      // Check if already exists
      let fileRecord = FileModel.getByPath(file.path);

      if (!fileRecord) {
        fileRecord = FileModel.create({
          filename: file.originalname,
          filepath: file.path,
          filetype: docType === 'markdown' ? 'document' : 'text',
          size: file.size,
          mimetype: file.mimetype,
        });
      }

      results.push({
        id: fileRecord.id,
        filename: file.originalname,
        filepath: file.path,
        size: file.size,
      });
    }

    res.json({
      success: true,
      message: `${results.length} document(s) uploaded successfully`,
      files: results,
    });

  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({
      error: "Failed to upload documents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Extract keywords from uploaded documents (for browser mode)
export async function extractDocumentKeywords(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No document files uploaded" });
    }

    const results: DocumentAnalysisResult[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      try {
        // Validate file type
        const docType = getDocumentType(file.originalname);
        if (docType === 'unknown') {
          errors.push({ filename: file.originalname, error: "Unsupported file type" });
          continue;
        }

        // Read content
        const content = readTextFile(file.path);

        // Analyze with Gemini
        const analysis = await analyzeWithGemini(content, 'both');

        // Save to database
        let fileRecord = FileModel.getByPath(file.path);

        if (!fileRecord) {
          fileRecord = FileModel.create({
            filename: file.originalname,
            filepath: file.path,
            filetype: docType === 'markdown' ? 'document' : 'text',
            size: file.size,
            mimetype: file.mimetype,
          });
        }

        const fileId = fileRecord.id!;

        // Clear existing and save new keywords
        KeywordModel.deleteByFileId(fileId);
        if (analysis.keywords && analysis.keywords.length > 0) {
          KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
          
          // Index keywords for semantic search (run in background)
          searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
            console.error('Failed to index document keywords:', err);
          });
        }

        // Save metadata
        MetadataModel.set(fileId, 'summary', analysis.summary || '');
        MetadataModel.set(fileId, 'word_count', content.split(/\s+/).filter(w => w.length > 0).length.toString());
        MetadataModel.set(fileId, 'character_count', content.length.toString());
        MetadataModel.set(fileId, 'document_type', docType);

        results.push({
          filepath: file.path,
          filename: file.originalname,
          content: content.slice(0, 1000) + (content.length > 1000 ? '...' : ''),
          summary: analysis.summary || '',
          keywords: analysis.keywords || [],
          wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
          characterCount: content.length
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({ filename: file.originalname, error: errorMessage });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("Document keyword extraction error:", error);
    res.status(500).json({
      error: "Failed to extract keywords from documents",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Update document content by file ID
export async function updateDocumentContent(req: Request, res: Response) {
  console.log('updateDocumentContent called with id:', req.params.id);
  console.log('Content length:', req.body?.content?.length);
  try {
    const { id } = req.params;
    const { content } = req.body;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ error: "Content must be a string" });
    }

    const fileRecord = FileModel.getById(fileId);

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    // Validate file type
    const docType = getDocumentType(fileRecord.filepath);
    if (docType === 'unknown') {
      return res.status(400).json({ error: "File is not a supported document type" });
    }

    // Write content to file
    fs.writeFileSync(fileRecord.filepath, content, 'utf-8');

    // Update metadata
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const characterCount = content.length;
    MetadataModel.set(fileId, 'word_count', wordCount.toString());
    MetadataModel.set(fileId, 'character_count', characterCount.toString());

    res.json({
      success: true,
      message: "Document saved successfully",
      wordCount,
      characterCount
    });

  } catch (error) {
    console.error("Update document content error:", error);
    res.status(500).json({
      error: "Failed to save document",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Process existing document with AI by file ID
export async function processDocumentWithAI(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    const fileRecord = FileModel.getById(fileId);

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    // Validate file type
    const docType = getDocumentType(fileRecord.filepath);
    if (docType === 'unknown') {
      return res.status(400).json({ error: "File is not a supported document type" });
    }

    // Read content
    const content = readTextFile(fileRecord.filepath);

    // Analyze with Gemini
    const analysis = await analyzeWithGemini(content, 'both');

    // Clear existing keywords
    KeywordModel.deleteByFileId(fileId);

    // Save keywords
    if (analysis.keywords && analysis.keywords.length > 0) {
      KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
      
      // Index keywords for semantic search (run in background)
      searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
        console.error('Failed to index document keywords:', err);
      });
    }

    // Update metadata
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const characterCount = content.length;
    MetadataModel.set(fileId, 'summary', analysis.summary || '');
    MetadataModel.set(fileId, 'word_count', wordCount.toString());
    MetadataModel.set(fileId, 'character_count', characterCount.toString());
    MetadataModel.set(fileId, 'document_type', docType);

    res.json({
      success: true,
      file: fileRecord,
      summary: analysis.summary || '',
      keywords: analysis.keywords || [],
      wordCount,
      characterCount
    });

  } catch (error) {
    console.error("Process document with AI error:", error);
    res.status(500).json({
      error: "Failed to process document with AI",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Get document content by file ID
export async function getDocumentContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const fileId = parseInt(id);

    if (isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    const fileRecord = FileModel.getById(fileId);

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    // Validate file type
    const docType = getDocumentType(fileRecord.filepath);
    if (docType === 'unknown') {
      return res.status(400).json({ error: "File is not a supported document type" });
    }

    // Read content
    const content = readTextFile(fileRecord.filepath);

    // Get metadata
    const keywords = KeywordModel.getByFileId(fileId);
    const metadata = MetadataModel.getByFileId(fileId);

    const metadataMap: Record<string, string> = {};
    for (const m of metadata) {
      metadataMap[m.key] = m.value;
    }

    res.json({
      success: true,
      file: fileRecord,
      content,
      summary: metadataMap['summary'] || '',
      keywords,
      wordCount: parseInt(metadataMap['word_count'] || '0'),
      characterCount: parseInt(metadataMap['character_count'] || '0'),
      documentType: metadataMap['document_type'] || docType
    });

  } catch (error) {
    console.error("Get document content error:", error);
    res.status(500).json({
      error: "Failed to get document content",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
