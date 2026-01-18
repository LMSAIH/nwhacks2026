# Omni - AI-Powered File Management System

Omni is an intelligent file management application that uses AI to analyze, organize, and search through your documents, images, videos, and audio files. Built with React, Electron, and Express, it provides semantic search capabilities powered by embeddings and AI analysis.

![Omni Logo](frontend/public/image0.png)

## Features

- **AI-Powered Semantic Search** - Search your files using natural language queries
- **Multi-Media Support** - Manage documents, images, videos, and audio files
- **Video Frame Analysis** - Automatically extract keywords from video frames with timestamps
- **Audio Transcription** - Transcribe and analyze audio content
- **Document Analysis** - Extract keywords and generate summaries from text and markdown files
- **Image Analysis** - AI-powered image description and keyword extraction
- **Markdown Editor** - Built-in editor with live preview and formatting toolbar
- **Favorites & Recent Files** - Quick access to your important and recently accessed files
- **Desktop App** - Native Electron application for Windows, macOS, and Linux

## Prerequisites

Before installing Omni, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **FFmpeg** (Required for video processing)
   - FFmpeg is a prerequisite for the `semantic-video` library used for video frame analysis
   
   **Windows:**
   ```bash
   # Using Chocolatey
   choco install ffmpeg
   
   # Or using winget
   winget install FFmpeg
   ```
   
   **macOS:**
   ```bash
   # Using Homebrew
   brew install ffmpeg
   ```
   
   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```

3. **API Keys**
   - **OpenRouter API Key** - Required for AI analysis (Gemini model)
     - Get your key at [openrouter.ai](https://openrouter.ai/)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/LMSAIH/nwhacks2026.git
cd nwhacks2026
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit the `.env` file and add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
OPEN_ROUTER_KEY=your_open_router_key_here
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

## Running the Application

### Development Mode

You'll need two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`

### Running as Desktop App (Electron)

```bash
cd frontend
npm run dev:electron
```

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend (Web):**
```bash
cd frontend
npm run build
npm run preview
```

**Frontend (Desktop App):**
```bash
cd frontend
npm run build:electron
```

The built application will be in `frontend/dist/`

## Project Structure

```
omni/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── db/             # SQLite database setup
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic (embeddings, search)
│   │   └── server.ts       # Main server file
│   ├── uploads/            # Uploaded files storage
│   └── data/               # SQLite database files
│
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and API client
│   │   └── types/          # TypeScript types
│   ├── electron/           # Electron main process
│   └── public/             # Static assets
│
└── README.md
```

## Tech Stack

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **SQLite** (better-sqlite3) - Local database
- **Xenova Transformers** - Local embeddings generation
- **semantic-video** - Video frame extraction and analysis
- **OpenRouter API** - AI model access (Gemini)

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool
- **Electron** - Desktop application
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Markdown** - Markdown rendering

## How Embeddings Work

Omni uses **semantic embeddings** to enable natural language search across all your files. Instead of simple keyword matching, the system understands the *meaning* behind your search queries.

### Embedding Model

The project uses **`Xenova/all-MiniLM-L6-v2`** - a lightweight, efficient sentence transformer model that runs entirely locally via [@xenova/transformers](https://github.com/xenova/transformers.js). This model:

- Generates 384-dimensional embedding vectors
- Runs locally without requiring external API calls
- Is optimized for semantic similarity tasks
- Downloads automatically on first use (~23MB)

### How It Works

1. **Keyword Extraction**: When you process a file with AI (document, image, video, or audio), the AI extracts relevant keywords describing the content.

2. **Embedding Generation**: Each extracted keyword is converted into a 384-dimensional vector using the MiniLM model. This vector captures the semantic meaning of the keyword.

3. **Storage**: Embeddings are stored as binary blobs in the SQLite database (`backend/data/metadata.db`) in the `keyword_embeddings` table:
   ```sql
   CREATE TABLE keyword_embeddings (
     id INTEGER PRIMARY KEY,
     keyword TEXT UNIQUE NOT NULL,
     embedding BLOB NOT NULL,  -- Float32Array stored as binary
     created_at DATETIME
   );
   ```

4. **Semantic Search**: When you search:
   - Your query is converted to an embedding vector
   - The system calculates **cosine similarity** between your query and all stored keyword embeddings
   - Files containing keywords with high similarity scores are returned
   - Results are ranked by relevance (similarity score)

### Example

If you search for "cooking recipes", the system will find files with keywords like:
- "food preparation" (high similarity)
- "kitchen" (moderate similarity)
- "ingredients" (moderate similarity)
- "chef" (moderate similarity)

Even though none of these keywords exactly match "cooking recipes", the semantic understanding connects them if they have already been indexed during your media analysis.

## API Endpoints

### Files
- `GET /api/files` - Get all files
- `GET /api/files/:id` - Get file by ID
- `POST /api/files/register` - Register a local file
- `PATCH /api/files/:id/favorite` - Toggle favorite status
- `DELETE /api/files/:id` - Delete a file

### Documents
- `POST /api/document/create` - Create a new document
- `GET /api/document/:id/content` - Get document content
- `PUT /api/document/:id/content` - Update document content
- `POST /api/document/:id/process-ai` - Process document with AI
- `POST /api/document/process` - Process multiple documents

### Media
- `POST /api/video/process` - Process videos for keywords
- `POST /api/audio/process` - Process audio files
- `POST /api/image/process` - Process images

### Search
- `GET /api/search` - Semantic search across all files
- `GET /api/search/keywords` - Find similar keywords
- `POST /api/search/index` - Index all keywords for search

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Backend server port (default: 3000) | No |
| `OPEN_ROUTER_KEY` | OpenRouter API key for AI analysis | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |

## Troubleshooting

### FFmpeg not found
If you get errors related to video processing, ensure FFmpeg is properly installed and available in your system PATH:
```bash
ffmpeg -version
```

### Port already in use
If port 3000 or 5173 is already in use, you can change them:
- Backend: Update `PORT` in `.env`
- Frontend: Update `vite.config.ts`

### Database errors
The SQLite database is automatically created in `backend/data/`. If you encounter issues, try deleting the database file and restarting the backend.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Built for nwHacks 2026
- Uses [OpenRouter](https://openrouter.ai/) for AI model access
- Video processing powered by [semantic-video](https://www.npmjs.com/package/semantic-video) (requires FFmpeg)
- Embeddings generated using [Xenova Transformers](https://github.com/xenova/transformers.js)
