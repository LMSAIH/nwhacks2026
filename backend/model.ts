import EmbeddingService from './src/services/embeddingService'

async function testModel() {
  console.log('🚀 Testing Hugging Face all-MiniLM-L6-v2 model...')
  
  try {
    // Get the embedding service instance
    const embeddingService = EmbeddingService.getInstance()
    
    // Test single text embedding
    const testText = "Hello, this is a test sentence for generating embeddings."
    console.log(`📝 Input text: "${testText}"`)
    
    console.log('⏳ Generating embedding...')
    const embedding = await embeddingService.generateEmbedding(testText)
    
    console.log(`✅ Embedding generated successfully!`)
    console.log(`📊 Dimensions: ${embedding.length}`)
    console.log(`🔢 First 10 values: [${embedding.slice(0, 10).map(n => n.toFixed(4)).join(', ')}...]`)
    
    // Test batch embeddings
    const testTexts = [
      "The weather is beautiful today.",
      "I love programming with TypeScript.",
      "Machine learning models are fascinating."
    ]
    
    console.log('\n📦 Testing batch embeddings...')
    const batchEmbeddings = await embeddingService.generateEmbeddings(testTexts)
    
    console.log(`✅ Batch embeddings generated successfully!`)
    console.log(`📊 Number of embeddings: ${batchEmbeddings.length}`)
    batchEmbeddings.forEach((emb, idx) => {
      console.log(`   Text ${idx + 1}: ${emb.length} dimensions`)
    })
    
    // Test similarity
    console.log('\n🔍 Testing similarity calculation...')
    const text1 = "The cat is sleeping."
    const text2 = "A cat is taking a nap."
    const text3 = "The dog is running fast."
    
    const embedding1 = await embeddingService.generateEmbedding(text1)
    const embedding2 = await embeddingService.generateEmbedding(text2)
    const embedding3 = await embeddingService.generateEmbedding(text3)
    
    const similarity12 = embeddingService.calculateCosineSimilarity(embedding1, embedding2)
    const similarity13 = embeddingService.calculateCosineSimilarity(embedding1, embedding3)
    
    console.log(`📐 Similarity between "${text1}" and "${text2}": ${similarity12.toFixed(4)}`)
    console.log(`📐 Similarity between "${text1}" and "${text3}": ${similarity13.toFixed(4)}`)
    
    console.log('\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Error testing model:', error)
    process.exit(1)
  }
}

// Run the test
testModel()