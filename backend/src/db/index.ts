import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbDir = path.join(__dirname, '../../data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db: DatabaseType = new Database(path.join(dbDir, 'metadata.db'))

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    filepath TEXT UNIQUE NOT NULL,
    filetype TEXT NOT NULL,
    size INTEGER,
    mimetype TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS file_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, key)
  );

  -- General keywords for all file types
  CREATE TABLE IF NOT EXISTS file_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, keyword)
  );

  -- Video-specific frame keywords (maps each keyword to specific frames)
  CREATE TABLE IF NOT EXISTS video_frame_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    frame_index INTEGER NOT NULL,
    timestamp REAL,
    confidence REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS file_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_files_filepath ON files(filepath);
  CREATE INDEX IF NOT EXISTS idx_files_filetype ON files(filetype);
  CREATE INDEX IF NOT EXISTS idx_file_keywords_keyword ON file_keywords(keyword);
  CREATE INDEX IF NOT EXISTS idx_video_frame_keywords_keyword ON video_frame_keywords(keyword);
  CREATE INDEX IF NOT EXISTS idx_video_frame_keywords_file_frame ON video_frame_keywords(file_id, frame_index);
  CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag);

  -- Keyword embeddings table for semantic search
  CREATE TABLE IF NOT EXISTS keyword_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT UNIQUE NOT NULL,
    embedding BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_keyword_embeddings_keyword ON keyword_embeddings(keyword);
`)

export default db
