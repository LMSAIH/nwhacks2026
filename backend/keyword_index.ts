import EmbeddingService from './src/services/embeddingService'

async function testKeywordIndexing() {
  console.log('🔑 Testing Keyword Indexing and Query Workflow...\n')
  
  const service = EmbeddingService.getInstance()
  
  try {
    // Step 1: Index keywords (comma-separated input)
    const keywordsInput = `
      machine learning, deep learning, neural networks, 
      artificial intelligence, natural language processing,
      computer vision, data science, python programming,
      web development, react, typescript, nodejs,
      database, sql, mongodb, cloud computing,
      devops, docker, kubernetes, microservices,
      cybersecurity, blockchain, iot, edge computing
    `
    
    console.log('📥 Step 1: Indexing keywords from comma-separated input...')
    console.log(`Input: "${keywordsInput.trim().substring(0, 80)}..."`)
    
    const indexedKeywords = await service.indexKeywords(keywordsInput)
    console.log(`✅ Indexed ${indexedKeywords.length} keywords:`)
    indexedKeywords.forEach((kw: string, i: number) => console.log(`   ${i + 1}. ${kw}`))
    
    // Step 2: User sends a prompt
    console.log('\n📝 Step 2: User sends prompts to query keywords...\n')
    
    const prompts = [
      "I want to build AI models that can understand text",
      "How do I deploy my application to the cloud?",
      "I need to learn about frontend frameworks",
      "Security is important for my project"
    ]
    
    for (const prompt of prompts) {
      console.log(`🔍 Prompt: "${prompt}"`)
      
      // Step 3: Get top-K similar keywords
      const topK = await service.queryKeywords(prompt, 5)
      
      console.log('🏆 Top-5 Keywords:')
      topK.forEach((result: any, i: number) => {
        const percentage = Math.round(result.similarity * 100)
        console.log(`   ${i + 1}. "${result.keyword}" (${percentage}% match)`)
      })
      console.log()
    }
    
    // Demonstrate adding more keywords
    console.log('➕ Adding more keywords to the index...')
    const newKeywords = await service.addKeywords('rust, golang, java, c++')
    console.log(`Added: ${newKeywords.join(', ')}`)
    console.log(`Total indexed keywords: ${service.getIndexSize()}`)
    
    // Query again with new keywords available
    console.log('\n🔍 Querying again with expanded index:')
    const systemsPrompt = "I need a fast systems programming language"
    console.log(`Prompt: "${systemsPrompt}"`)
    
    const results = await service.queryKeywords(systemsPrompt, 5)
    console.log('🏆 Top-5 Keywords:')
    results.forEach((result: any, i: number) => {
      const percentage = Math.round(result.similarity * 100)
      console.log(`   ${i + 1}. "${result.keyword}" (${percentage}% match)`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the test
testKeywordIndexing().then(() => {
  console.log('\n✅ Keyword indexing test completed!')
  process.exit(0)
}).catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})