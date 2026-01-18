import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  FileModel,
  KeywordModel,
  MetadataModel,
} from "../models/fileModel";
import SearchService from "../services/searchService";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const searchService = SearchService.getInstance();

// Helper to get mimetype from extension
const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'image/jpeg';
};

// Helper to determine if file is a supported image
function isImageFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
}

// Convert image file to base64
function imageToBase64(filepath: string): string {
  const imageBuffer = fs.readFileSync(filepath);
  return imageBuffer.toString('base64');
}

// Analyze image with OpenAI GPT-4o-mini (vision capable)
async function analyzeImageWithAI(filepath: string): Promise<{ keywords: string[]; description: string }> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }

  const base64Image = imageToBase64(filepath);
  const mimeType = getMimeType(filepath);

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and return a JSON object with this exact structure:
{
  "keywords": ["keyword1", "keyword2", ...],
  "description": "A 2-3 sentence description of what's happening in the image"
}

Extract 10-15 relevant keywords that describe the image content, subjects, setting, and any text visible. Return ONLY the JSON, no other text.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 400
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const responseText = data.choices?.[0]?.message?.content || "";
  
  console.log('OpenAI raw response:', JSON.stringify(data, null, 2));
  console.log('Response text:', responseText);

  // Parse JSON response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    console.log('JSON match:', jsonMatch?.[0]);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed result:', parsed);
      return {
        keywords: parsed.keywords || [],
        description: parsed.description || ""
      };
    }
  } catch (e) {
    console.warn("Failed to parse JSON response from image analysis:", e);
    console.warn("Raw response was:", responseText);
  }

  return {
    keywords: [],
    description: responseText.trim()
  };
}

interface ImageAnalysisResult {
  filepath: string;
  filename: string;
  keywords: string[];
  description: string;
}

// Process images from local filepaths (for Electron - no file duplication)
export async function processLocalImages(req: Request, res: Response) {
  try {
    const { filepaths } = req.body;
    console.log('processLocalImages called with body:', req.body);
    console.log('filepaths:', filepaths);

    if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
      console.log('No filepaths provided - returning error');
      return res.status(400).json({ error: "filepaths array is required" });
    }

    const results: ImageAnalysisResult[] = [];
    const errors: { filepath: string; error: string }[] = [];

    for (const filepath of filepaths) {
      try {
        // Validate file exists
        if (!fs.existsSync(filepath)) {
          errors.push({ filepath, error: "File not found" });
          continue;
        }

        // Validate file type
        if (!isImageFile(filepath)) {
          errors.push({ filepath, error: "Unsupported image format" });
          continue;
        }

        // Analyze with AI
        const analysis = await analyzeImageWithAI(filepath);

        // Get file stats
        const stats = fs.statSync(filepath);
        const filename = path.basename(filepath);

        // Save to database
        let fileRecord = FileModel.getByPath(filepath);

        if (!fileRecord) {
          fileRecord = FileModel.create({
            filename,
            filepath,
            filetype: 'image',
            size: stats.size,
            mimetype: getMimeType(filepath),
          });
        }

        const fileId = fileRecord.id!;

        // Clear existing and save new keywords
        KeywordModel.deleteByFileId(fileId);
        if (analysis.keywords.length > 0) {
          KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
          
          // Index keywords for semantic search (run in background)
          searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
            console.error('Failed to index image keywords:', err);
          });
        }

        // Save metadata
        MetadataModel.set(fileId, 'description', analysis.description);
        MetadataModel.set(fileId, 'ai_analyzed', 'true');
        MetadataModel.set(fileId, 'analyzed_at', new Date().toISOString());

        results.push({
          filepath,
          filename,
          keywords: analysis.keywords,
          description: analysis.description
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
    console.error("Image processing error:", error);
    res.status(500).json({
      error: "Failed to process images",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Upload and process images (for browser mode - copies files)
export async function uploadAndProcessImages(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    console.log('uploadAndProcessImages called, files:', files?.map(f => f.originalname));

    if (!files || files.length === 0) {
      console.log('No files in request');
      return res.status(400).json({ error: "No image files uploaded", success: false, processed: 0, results: [] });
    }

    const results: ImageAnalysisResult[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      try {
        console.log('Processing file:', file.originalname, 'at path:', file.path);
        
        // Validate file type
        if (!isImageFile(file.originalname)) {
          errors.push({ filename: file.originalname, error: "Unsupported image format" });
          continue;
        }

        // Analyze with AI
        console.log('Calling AI analysis for:', file.path);
        const analysis = await analyzeImageWithAI(file.path);
        console.log('AI analysis result:', analysis);

        // Save to database
        let fileRecord = FileModel.getByPath(file.path);

        if (!fileRecord) {
          fileRecord = FileModel.create({
            filename: file.originalname,
            filepath: file.path,
            filetype: 'image',
            size: file.size,
            mimetype: file.mimetype,
          });
        }

        const fileId = fileRecord.id!;

        // Clear existing and save new keywords
        KeywordModel.deleteByFileId(fileId);
        if (analysis.keywords.length > 0) {
          KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
          
          // Index keywords for semantic search
          searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
            console.error('Failed to index image keywords:', err);
          });
        }

        // Save metadata
        MetadataModel.set(fileId, 'description', analysis.description);
        MetadataModel.set(fileId, 'ai_analyzed', 'true');
        MetadataModel.set(fileId, 'analyzed_at', new Date().toISOString());

        results.push({
          filepath: file.path,
          filename: file.originalname,
          keywords: analysis.keywords,
          description: analysis.description
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
      savedFiles: results.map(r => ({
        filename: r.filename,
        filepath: r.filepath
      })),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error("Image upload and processing error:", error);
    res.status(500).json({
      error: "Failed to process images",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Upload images only (no AI analysis)
export async function uploadImagesOnly(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No image files uploaded" });
    }

    const results = [];

    for (const file of files) {
      // Validate file type
      if (!isImageFile(file.originalname)) {
        continue;
      }

      // Check if already exists
      let fileRecord = FileModel.getByPath(file.path);

      if (!fileRecord) {
        fileRecord = FileModel.create({
          filename: file.originalname,
          filepath: file.path,
          filetype: 'image',
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
      message: `${results.length} image(s) uploaded successfully`,
      files: results,
    });

  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      error: "Failed to upload images",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Get image analysis by file ID
export async function getImageAnalysis(req: Request, res: Response) {
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

    if (fileRecord.filetype !== 'image') {
      return res.status(400).json({ error: "File is not an image" });
    }

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
      analysis: {
        keywords,
        description: metadataMap['description'] || '',
        objects: metadataMap['objects'] ? JSON.parse(metadataMap['objects']) : [],
        colors: metadataMap['colors'] ? JSON.parse(metadataMap['colors']) : [],
        mood: metadataMap['mood'] || '',
        aiAnalyzed: metadataMap['ai_analyzed'] === 'true',
        analyzedAt: metadataMap['analyzed_at'] || null
      }
    });

  } catch (error) {
    console.error("Get image analysis error:", error);
    res.status(500).json({
      error: "Failed to get image analysis",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Analyze a single image by ID (re-analyze)
export async function analyzeImageById(req: Request, res: Response) {
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

    if (fileRecord.filetype !== 'image') {
      return res.status(400).json({ error: "File is not an image" });
    }

    if (!fs.existsSync(fileRecord.filepath)) {
      return res.status(404).json({ error: "Image file not found on disk" });
    }

    // Analyze with AI
    const analysis = await analyzeImageWithAI(fileRecord.filepath);

    // Clear existing and save new keywords
    KeywordModel.deleteByFileId(fileId);
    if (analysis.keywords.length > 0) {
      KeywordModel.addMany(fileId, analysis.keywords.map(k => k.trim()));
      
      // Index keywords for semantic search
      searchService.storeKeywordEmbeddings(analysis.keywords.map(k => k.trim())).catch(err => {
        console.error('Failed to index image keywords:', err);
      });
    }

    // Save metadata
    MetadataModel.set(fileId, 'description', analysis.description);
    MetadataModel.set(fileId, 'ai_analyzed', 'true');
    MetadataModel.set(fileId, 'analyzed_at', new Date().toISOString());

    res.json({
      success: true,
      file: fileRecord,
      analysis: {
        keywords: analysis.keywords,
        description: analysis.description
      }
    });

  } catch (error) {
    console.error("Analyze image error:", error);
    res.status(500).json({
      error: "Failed to analyze image",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
