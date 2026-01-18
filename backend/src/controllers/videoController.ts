import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import SemanticVideoClient from "semantic-video";
import {
  FileModel,
  KeywordModel,
  VideoFrameKeywordModel,
} from "../models/fileModel";
import SearchService from "../services/searchService";

const apiKey = process.env.OPENAI_API_KEY || "";
const searchService = SearchService.getInstance();

// Helper to get mimetype from extension
const getMimeType = (filepath: string): string => {
  const ext = path.extname(filepath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
  };
  return mimeTypes[ext] || 'video/mp4';
};

// Process videos from local filepaths (no upload, no copying)
export const processLocalVideos = async (req: Request, res: Response) => {
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
    res.status(400).json({ error: "No valid video files found", invalidPaths });
    return;
  }

  try {
    const client = new SemanticVideoClient(apiKey, { enabled: false }, 3, 10);

    // Prepare video configs for batch processing
    const videoConfigs = validPaths.map((filepath) => ({
      videoPath: filepath,
      numPartitions: 10,
      prompt:
        "List only the main keywords that describe what you see in this frame. Output ONLY comma-separated keywords, nothing else. Example: person, car, street, daytime, walking",
    }));

    // Process all videos concurrently
    const allResults = await client.analyzeMultipleVideos(videoConfigs);

    // Extract keywords from all videos
    // Each result has: videoPath, frames (array), tokensUsed
    const videoResults = allResults.map((result) => {
      const allKeywords = new Set<string>();
      // Use videoPath from result to ensure correct video-keyword association
      const filepath = result.videoPath;

      // Get keywords per frame
      const framesWithKeywords = result.frames.map(
        (
          frame: { description?: string; timestamp?: number },
          frameIndex: number,
        ) => {
          const frameKeywords = frame.description
            ? frame.description
                .split(",")
                .map((k: string) => k.trim().toLowerCase())
                .filter((k: string) => k.length > 0 && k.length < 50)
            : [];

          frameKeywords.forEach((k: string) => allKeywords.add(k));

          return {
            frameIndex,
            timestamp: frame.timestamp,
            keywords: frameKeywords.join(", "),
            keywordsArray: frameKeywords,
          };
        },
      );

      const keywordsArray = Array.from(allKeywords);

      return {
        filepath,
        filename: path.basename(filepath),
        keywords: keywordsArray.join(", "),
        keywordsArray,
        framesAnalyzed: result.frames.length,
        frames: framesWithKeywords,
      };
    });

    // Combine all keywords from all videos
    const combinedKeywords = new Set<string>();
    videoResults.forEach((r) =>
      r.keywordsArray.forEach((k) => combinedKeywords.add(k)),
    );

    // Save each video to the database
    const savedFiles = videoResults.map((result) => {
      const stats = fs.statSync(result.filepath);
      
      // Check if already registered
      let savedFile = FileModel.getByPath(result.filepath);
      
      if (!savedFile) {
        // Create file record
        savedFile = FileModel.create({
          filename: result.filename,
          filepath: result.filepath,
          filetype: "video",
          size: stats.size,
          mimetype: getMimeType(result.filepath),
        });
      } else {
        // Clear existing keywords if re-processing
        KeywordModel.deleteByFileId(savedFile.id!);
        VideoFrameKeywordModel.deleteByFileId(savedFile.id!);
      }

      // Add general keywords for the video
      if (result.keywordsArray.length > 0) {
        KeywordModel.addMany(savedFile.id!, result.keywordsArray);
      }

      // Add frame-specific keywords
      const frameKeywords = result.frames.map(
        (frame: {
          frameIndex: number;
          timestamp?: number;
          keywordsArray: string[];
        }) => ({
          frame_index: frame.frameIndex,
          timestamp: frame.timestamp,
          keyword: frame.keywordsArray.join(", "),
          confidence: 1.0,
        }),
      );

      if (frameKeywords.length > 0) {
        VideoFrameKeywordModel.addMany(savedFile.id!, frameKeywords);
      }

      return {
        id: savedFile.id,
        filename: savedFile.filename,
        filepath: savedFile.filepath,
      };
    });

    // Index keywords for semantic search (run in background)
    searchService.storeKeywordEmbeddings(Array.from(combinedKeywords)).catch(err => {
      console.error('Failed to index keywords:', err);
    });

    res.json({
      success: true,
      combinedKeywords: Array.from(combinedKeywords).join(", "),
      combinedKeywordsArray: Array.from(combinedKeywords),
      videos: videoResults,
      savedFiles,
      totalVideosProcessed: videoResults.length,
      ...(invalidPaths.length > 0 && { invalidPaths }),
    });

  } catch (error) {
    console.error("Video processing error:", error);
    res.status(500).json({
      error: "Failed to process videos",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Upload videos only (no AI processing) - for browser mode
export const uploadOnly = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No video files uploaded" });
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
          filetype: "video",
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
      error: "Failed to upload videos",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Legacy: Process uploaded videos (kept for backwards compatibility)
export const extractKeywords = async (req: Request, res: Response) => {
  if (!apiKey) {
    res.status(500).json({ error: "OpenAI API key not configured" });
    return;
  }

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No video files uploaded" });
    return;
  }

  // Map files to their paths for cleanup later
  const filePaths = files.map((f) => f.path);

  try {

    const client = new SemanticVideoClient(apiKey, { enabled: false }, 3, 10);

    // Prepare video configs for batch processing
    const videoConfigs = files.map((file) => ({
      videoPath: file.path,
      numPartitions: 10,
      prompt:
        "List only the main keywords that describe what you see in this frame. Output ONLY comma-separated keywords, nothing else. Example: person, car, street, daytime, walking",
    }));

    // Process all videos concurrently using built-in batch processing
    const allResults = await client.analyzeMultipleVideos(videoConfigs);

    // Extract keywords from all videos
    // Each result has: videoPath, frames (array), tokensUsed
    const videoResults = allResults.map((result) => {
      const allKeywords = new Set<string>();
      // Use videoPath from result to ensure correct video-keyword association
      const filepath = result.videoPath;
      // Find the matching file from the original upload
      const matchingFile = files.find(f => f.path === filepath);

      // Get keywords per frame
      const framesWithKeywords = result.frames.map(
        (
          frame: { description?: string; timestamp?: number },
          frameIndex: number,
        ) => {
          const frameKeywords = frame.description
            ? frame.description
                .split(",")
                .map((k: string) => k.trim().toLowerCase())
                .filter((k: string) => k.length > 0 && k.length < 50)
            : [];

          frameKeywords.forEach((k: string) => allKeywords.add(k));

          return {
            frameIndex,
            timestamp: frame.timestamp,
            keywords: frameKeywords.join(", "),
            keywordsArray: frameKeywords,
          };
        },
      );

      const keywordsArray = Array.from(allKeywords);

      return {
        filepath,
        filename: matchingFile?.originalname || path.basename(filepath),
        keywords: keywordsArray.join(", "),
        keywordsArray,
        framesAnalyzed: result.frames.length,
        frames: framesWithKeywords,
      };
    });

    // Combine all keywords from all videos
    const combinedKeywords = new Set<string>();
    videoResults.forEach((r) =>
      r.keywordsArray.forEach((k) => combinedKeywords.add(k)),
    );

    // Save each video to the database
    const savedFiles = videoResults.map((result) => {
      // Find the matching file from the original upload
      const file = files.find(f => f.path === result.filepath);
      if (!file) {
        console.warn(`Could not find matching file for ${result.filepath}`);
        return null;
      }

      // Create file record
      const savedFile = FileModel.create({
        filename: file.originalname,
        filepath: file.path,
        filetype: "video",
        size: file.size,
        mimetype: file.mimetype,
      });

      // Add general keywords for the video
      if (result.keywordsArray.length > 0) {
        KeywordModel.addMany(savedFile.id!, result.keywordsArray);
      }

      // Add frame-specific keywords
      const frameKeywords = result.frames.map(
        (frame: {
          frameIndex: number;
          timestamp?: number;
          keywordsArray: string[];
        }) => ({
          frame_index: frame.frameIndex,
          timestamp: frame.timestamp,
          keyword: frame.keywordsArray.join(", "),
          confidence: 1.0,
        }),
      );

      if (frameKeywords.length > 0) {
        VideoFrameKeywordModel.addMany(savedFile.id!, frameKeywords);
      }

      return {
        id: savedFile.id,
        filename: savedFile.filename,
        filepath: savedFile.filepath,
      };
    }).filter(Boolean);

    // Keep uploaded files so they can be viewed later

    res.json({
      success: true,
      combinedKeywords: Array.from(combinedKeywords).join(", "),
      combinedKeywordsArray: Array.from(combinedKeywords),
      videos: videoResults,
      savedFiles,
      totalVideosProcessed: videoResults.length,
    });
  } catch (error) {
    // Keep uploaded files even on error so they can be debugged or retried

    console.error("Video processing error:", error);
    res.status(500).json({
      error: "Failed to process videos",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
