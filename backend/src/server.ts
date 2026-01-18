import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import routes from './routes'
import EmbeddingService from './services/embeddingService'

const app = express()
const PORT = process.env.PORT || 3000

// Initialize embedding service
const embeddingService = EmbeddingService.getInstance()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'API is running' })
})

app.use((req: Request, res: Response, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
});

app.use('/api', routes)

// Embedding endpoints
app.post('/api/embeddings/single', async (req: Request, res: Response) => {
  try {
    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' })
    }

    const embedding = await embeddingService.generateEmbedding(text)
    
    res.json({
      text,
      embedding,
      dimension: embedding.length
    })
  } catch (error) {
    console.error('Error generating embedding:', error)
    res.status(500).json({ error: 'Failed to generate embedding' })
  }
})

app.post('/api/embeddings/batch', async (req: Request, res: Response) => {
  try {
    const { texts } = req.body

    if (!Array.isArray(texts) || texts.some(text => typeof text !== 'string')) {
      return res.status(400).json({ error: 'Texts must be an array of strings' })
    }

    const embeddings = await embeddingService.generateEmbeddings(texts)
    
    res.json({
      texts,
      embeddings,
      count: embeddings.length,
      dimension: embeddings[0]?.length || 0
    })
  } catch (error) {
    console.error('Error generating embeddings:', error)
    res.status(500).json({ error: 'Failed to generate embeddings' })
  }
})

app.post('/api/similarity', async (req: Request, res: Response) => {
  try {
    const { text1, text2 } = req.body

    if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
      return res.status(400).json({ error: 'Both text1 and text2 are required and must be strings' })
    }

    const [embedding1, embedding2] = await embeddingService.generateEmbeddings([text1, text2])
    const similarity = embeddingService.calculateCosineSimilarity(embedding1, embedding2)
    
    res.json({
      text1,
      text2,
      similarity,
      percentage: Math.round(similarity * 100)
    })
  } catch (error) {
    console.error('Error calculating similarity:', error)
    res.status(500).json({ error: 'Failed to calculate similarity' })
  }
})

app.post('/api/find-similar', async (req: Request, res: Response) => {
  try {
    const { query, candidates } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' })
    }

    if (!Array.isArray(candidates) || candidates.some(text => typeof text !== 'string')) {
      return res.status(400).json({ error: 'Candidates must be an array of strings' })
    }

    const result = await embeddingService.findMostSimilar(query, candidates)
    
    res.json({
      query,
      mostSimilar: result,
      percentage: Math.round(result.similarity * 100)
    })
  } catch (error) {
    console.error('Error finding similar text:', error)
    res.status(500).json({ error: 'Failed to find similar text' })
  }
})

// Initialize model on startup
app.post('/api/initialize', async (req: Request, res: Response) => {
  try {
    await embeddingService.initializeModel()
    res.json({ message: 'Model initialized successfully' })
  } catch (error) {
    console.error('Error initializing model:', error)
    res.status(500).json({ error: 'Failed to initialize model' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
