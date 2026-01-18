import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import {
  FileModel,
  KeywordModel,
  MetadataModel,
} from "../models/fileModel";
import SearchService from "../services/searchService";

const apiKey = process.env.OPENAI_API_KEY || "";
const searchService = SearchService.getInstance();

// Helper to get mimetype from extension
const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wma': 'audio/x-ms-wma',
    '.webm': 'audio/webm',
  };
  return mimeTypes[ext] || 'audio/mpeg';
};

interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

interface AudioAnalysisResult {
  filepath: string;
  filename: string;
  transcription: string;
  keywords: string[];
  language?: string;
  duration?: number;
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(openai: OpenAI, filepath: string): Promise<TranscriptionResult> {
  const audioFile = fs.createReadStream(filepath);
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  return {
    text: transcription.text,
    duration: transcription.duration,
    language: transcription.language,
  };
}

// Extract keywords from transcription using GPT
async function extractKeywordsFromText(openai: OpenAI, text: string): Promise<string[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a keyword extraction assistant. Extract the most important keywords and key phrases from the given text. 
Return ONLY a comma-separated list of keywords, nothing else.
Focus on:
- Main topics and subjects
- Important names (people, places, organizations)
- Key concepts and themes
- Technical terms if present
Limit to 20 most relevant keywords.`
      },
      {
        role: "user",
        content: text
      }
    ],
    max_tokens: 200,
    temperature: 0.3,
  });

  const keywordsText = response.choices[0]?.message?.content || "";
  return keywordsText
    .split(",")
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0 && k.length < 50);
}

// Process audio files from local filepaths (no upload, no copying)
export const processLocalAudio = async (req: Request, res: Response) => {
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const { filepaths } = req.body;

  if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
    res.status(400).json({ error: "filepaths array is required" });
    return;
  }

  // Validate all files exist
  const validPaths: string[] = [];
  const invalidPaths: string[] = [];
  
  for (const filepath of filepaths) {
    if (fs.existsSync(filepath)) {
      validPaths.push(filepath);
    } else {
      invalidPaths.push(filepath);
    }
  }

  if (validPaths.length === 0) {
    res.status(400).json({ error: "No valid audio files found", invalidPaths });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const audioResults: AudioAnalysisResult[] = [];

    // Process each audio file
    for (const filepath of validPaths) {
      try {
        // Step 1: Transcribe audio
        const transcription = await transcribeAudio(openai, filepath);
        
        // Step 2: Extract keywords from transcription
        const keywords = await extractKeywordsFromText(openai, transcription.text);

        audioResults.push({
          filepath,
          filename: path.basename(filepath),
          transcription: transcription.text,
          keywords,
          language: transcription.language,
          duration: transcription.duration,
        });
      } catch (error) {
        console.error(`Error processing ${filepath}:`, error);
        audioResults.push({
          filepath,
          filename: path.basename(filepath),
          transcription: "",
          keywords: [],
          language: undefined,
          duration: undefined,
        });
      }
    }

    // Combine all keywords from all audio files
    const combinedKeywords = new Set<string>();
    audioResults.forEach(r => r.keywords.forEach(k => combinedKeywords.add(k)));

    // Save each audio file to the database
    const savedFiles = audioResults.map((result) => {
      const stats = fs.statSync(result.filepath);
      
      // Check if already registered
      let savedFile = FileModel.getByPath(result.filepath);
      
      if (!savedFile) {
        // Create file record
        savedFile = FileModel.create({
          filename: result.filename,
          filepath: result.filepath,
          filetype: "audio",
          size: stats.size,
          mimetype: getMimeType(result.filepath),
        });
      } else {
        // Clear existing keywords if re-processing
        KeywordModel.deleteByFileId(savedFile.id!);
      }

      // Add keywords
      if (result.keywords.length > 0) {
        KeywordModel.addMany(savedFile.id!, result.keywords);
      }

      // Save transcription and metadata
      if (result.transcription) {
        MetadataModel.set(savedFile.id!, "transcription", result.transcription);
      }
      if (result.language) {
        MetadataModel.set(savedFile.id!, "language", result.language);
      }
      if (result.duration) {
        MetadataModel.set(savedFile.id!, "duration", String(result.duration));
      }

      return {
        id: savedFile.id,
        filename: savedFile.filename,
        filepath: savedFile.filepath,
      };
    });

    // Index keywords for semantic search (run in background)
    searchService.storeKeywordEmbeddings(Array.from(combinedKeywords)).catch(err => {
      console.error('Failed to index audio keywords:', err);
    });

    res.json({
      success: true,
      combinedKeywords: Array.from(combinedKeywords).join(", "),
      combinedKeywordsArray: Array.from(combinedKeywords),
      audioFiles: audioResults,
      savedFiles,
      totalAudioProcessed: audioResults.length,
      ...(invalidPaths.length > 0 && { invalidPaths }),
    });

  } catch (error) {
    console.error("Audio processing error:", error);
    res.status(500).json({
      error: "Failed to process audio files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Upload audio files only (no AI processing) - for browser mode
export const uploadAudioOnly = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No audio files uploaded" });
    return;
  }

  try {
    const savedFiles = files.map((file) => {
      // Check if already registered
      let savedFile = FileModel.getByPath(file.path);

      if (!savedFile) {
        // Create file record
        savedFile = FileModel.create({
          filename: file.originalname,
          filepath: file.path,
          filetype: "audio",
          size: file.size,
          mimetype: file.mimetype,
        });
      }

      return savedFile;
    });

    res.json({
      success: true,
      files: savedFiles,
      totalFilesUploaded: savedFiles.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: "Failed to upload audio files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Process uploaded audio files with AI (browser mode)
export const extractAudioKeywords = async (req: Request, res: Response) => {
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No audio files uploaded" });
    return;
  }

  const filePaths = files.map((f) => f.path);

  try {
    const openai = new OpenAI({ apiKey });
    const audioResults: AudioAnalysisResult[] = [];

    // Process each audio file
    for (const file of files) {
      try {
        // Step 1: Transcribe audio
        const transcription = await transcribeAudio(openai, file.path);
        
        // Step 2: Extract keywords from transcription
        const keywords = await extractKeywordsFromText(openai, transcription.text);

        audioResults.push({
          filepath: file.path,
          filename: file.originalname,
          transcription: transcription.text,
          keywords,
          language: transcription.language,
          duration: transcription.duration,
        });
      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        audioResults.push({
          filepath: file.path,
          filename: file.originalname,
          transcription: "",
          keywords: [],
        });
      }
    }

    // Combine all keywords
    const combinedKeywords = new Set<string>();
    audioResults.forEach(r => r.keywords.forEach(k => combinedKeywords.add(k)));

    // Save each audio file to the database
    const savedFiles = audioResults.map((result, index) => {
      const file = files[index];
      
      // Check if already registered
      let savedFile = FileModel.getByPath(result.filepath);
      
      if (!savedFile) {
        savedFile = FileModel.create({
          filename: result.filename,
          filepath: result.filepath,
          filetype: "audio",
          size: file.size,
          mimetype: file.mimetype,
        });
      } else {
        KeywordModel.deleteByFileId(savedFile.id!);
      }

      // Add keywords
      if (result.keywords.length > 0) {
        KeywordModel.addMany(savedFile.id!, result.keywords);
      }

      // Save transcription and metadata
      if (result.transcription) {
        MetadataModel.set(savedFile.id!, "transcription", result.transcription);
      }
      if (result.language) {
        MetadataModel.set(savedFile.id!, "language", result.language);
      }
      if (result.duration) {
        MetadataModel.set(savedFile.id!, "duration", String(result.duration));
      }

      return {
        id: savedFile.id,
        filename: savedFile.filename,
        filepath: savedFile.filepath,
      };
    });

    // Index keywords for semantic search (run in background)
    searchService.storeKeywordEmbeddings(Array.from(combinedKeywords)).catch(err => {
      console.error('Failed to index audio keywords:', err);
    });

    res.json({
      success: true,
      combinedKeywords: Array.from(combinedKeywords).join(", "),
      combinedKeywordsArray: Array.from(combinedKeywords),
      audioFiles: audioResults,
      savedFiles,
      totalAudioProcessed: audioResults.length,
    });

  } catch (error) {
    console.error("Audio processing error:", error);
    res.status(500).json({
      error: "Failed to process audio files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
