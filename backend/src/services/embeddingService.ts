import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers'

// Interface for indexed keyword with its embedding
interface IndexedKeyword {
  keyword: string
  embedding: number[]
}

class EmbeddingService {
  private static instance: EmbeddingService
  private model: FeatureExtractionPipeline | null = null
  private modelId = 'Xenova/all-MiniLM-L6-v2'
  
  // Store indexed keywords and their embeddings
  private keywordIndex: IndexedKeyword[] = []

  private constructor() {}

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService()
    }
    return EmbeddingService.instance
  }

  /**
   * Initialize the model (loads it from Hugging Face)
   */
  async initializeModel(): Promise<void> {
    if (this.model) {
      console.log('Model already initialized')
      return
    }

    try {
      console.log(`Loading model: ${this.modelId}`)
      this.model = await pipeline('feature-extraction', this.modelId, {
        quantized: false,
      })
      console.log('Model loaded successfully')
    } catch (error) {
      console.error('Failed to load model:', error)
      throw error
    }
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.model) {
      await this.initializeModel()
    }

    try {
      const output = await this.model!(text, { pooling: 'mean', normalize: true })
      return Array.from(output.data) as number[]
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      await this.initializeModel()
    }

    try {
      const embeddings: number[][] = []
      
      for (const text of texts) {
        const output = await this.model!(text, { pooling: 'mean', normalize: true })
        embeddings.push(Array.from(output.data) as number[])
      }
      
      return embeddings
    } catch (error) {
      console.error('Failed to generate embeddings:', error)
      throw error
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  /**
   * Find the most similar text from a list of candidates
   */
  async findMostSimilar(
    queryText: string,
    candidateTexts: string[]
  ): Promise<{ text: string; similarity: number; index: number }> {
    const queryEmbedding = await this.generateEmbedding(queryText)
    const candidateEmbeddings = await this.generateEmbeddings(candidateTexts)

    let maxSimilarity = -1
    let mostSimilarIndex = 0

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const similarity = this.calculateCosineSimilarity(queryEmbedding, candidateEmbeddings[i])
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity
        mostSimilarIndex = i
      }
    }

    return {
      text: candidateTexts[mostSimilarIndex],
      similarity: maxSimilarity,
      index: mostSimilarIndex
    }
  }

  /**
   * Find the top-K most similar texts from a list of candidates
   */
  async findTopKSimilar(
    queryText: string,
    candidateTexts: string[],
    k: number = 5
  ): Promise<{ text: string; similarity: number; index: number }[]> {
    const queryEmbedding = await this.generateEmbedding(queryText)
    const candidateEmbeddings = await this.generateEmbeddings(candidateTexts)

    // Calculate similarities for all candidates
    const similarities: { text: string; similarity: number; index: number }[] = []
    
    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const similarity = this.calculateCosineSimilarity(queryEmbedding, candidateEmbeddings[i])
      similarities.push({
        text: candidateTexts[i],
        similarity,
        index: i
      })
    }

    // Sort by similarity (highest first) and return top-K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(k, similarities.length))
  }

  /**
   * Rank all candidates by similarity (returns all items sorted by similarity)
   */
  async rankBySimilarity(
    queryText: string,
    candidateTexts: string[]
  ): Promise<{ text: string; similarity: number; index: number }[]> {
    return this.findTopKSimilar(queryText, candidateTexts, candidateTexts.length)
  }

  // ============================================
  // KEYWORD INDEX METHODS
  // ============================================

  /**
   * Index keywords from a comma-separated string
   * Creates embeddings for each keyword and stores them for later querying
   */
  async indexKeywords(keywordsString: string): Promise<string[]> {
    // Parse comma-separated keywords and trim whitespace
    const keywords = keywordsString
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)

    if (keywords.length === 0) {
      throw new Error('No valid keywords found in input')
    }

    console.log(`Indexing ${keywords.length} keywords...`)

    // Generate embeddings for all keywords
    const embeddings = await this.generateEmbeddings(keywords)

    // Store in the index
    this.keywordIndex = keywords.map((keyword, i) => ({
      keyword,
      embedding: embeddings[i]
    }))

    console.log(`Successfully indexed ${this.keywordIndex.length} keywords`)
    return keywords
  }

  /**
   * Add more keywords to the existing index
   */
  async addKeywords(keywordsString: string): Promise<string[]> {
    const keywords = keywordsString
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)

    if (keywords.length === 0) {
      throw new Error('No valid keywords found in input')
    }

    const embeddings = await this.generateEmbeddings(keywords)

    // Append to existing index
    keywords.forEach((keyword, i) => {
      this.keywordIndex.push({
        keyword,
        embedding: embeddings[i]
      })
    })

    return keywords
  }

  /**
   * Query the keyword index with a prompt and return top-K similar keywords
   */
  async queryKeywords(
    prompt: string,
    k: number = 5
  ): Promise<{ keyword: string; similarity: number }[]> {
    if (this.keywordIndex.length === 0) {
      throw new Error('No keywords indexed. Call indexKeywords() first.')
    }

    // Generate embedding for the prompt
    const promptEmbedding = await this.generateEmbedding(prompt)

    // Calculate similarity with each indexed keyword
    const similarities = this.keywordIndex.map(item => ({
      keyword: item.keyword,
      similarity: this.calculateCosineSimilarity(promptEmbedding, item.embedding)
    }))

    // Sort by similarity (highest first) and return top-K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(k, similarities.length))
  }

  /**
   * Get all indexed keywords
   */
  getIndexedKeywords(): string[] {
    return this.keywordIndex.map(item => item.keyword)
  }

  /**
   * Get the number of indexed keywords
   */
  getIndexSize(): number {
    return this.keywordIndex.length
  }

  /**
   * Clear the keyword index
   */
  clearIndex(): void {
    this.keywordIndex = []
    console.log('Keyword index cleared')
  }
}

export default EmbeddingService