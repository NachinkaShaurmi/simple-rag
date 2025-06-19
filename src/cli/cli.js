import readline from 'readline';
import { answerWithRAG } from '../rag/ragPipeline.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🏛️  Museum RAG System CLI');
console.log('Ask questions about the museum collection. Type "exit" to quit.\n');

const askQuestion = () => {
  rl.question('❓ Your question: ', async (question) => {
    if (question.toLowerCase() === 'exit') {
      console.log('Goodbye! 👋');
      rl.close();
      return;
    }
    
    if (!question.trim()) {
      console.log('Please enter a valid question.\n');
      askQuestion();
      return;
    }
    
    try {
      console.log('🔍 Searching and generating answer...\n');
      const startTime = Date.now();
      
      const result = await answerWithRAG(question);
      const processingTime = Date.now() - startTime;
      
      console.log('📝 Answer:');
      console.log(result.answer);
      console.log('\n📚 Sources:');
      
      result.sources.forEach((source, index) => {
        console.log(`\n${index + 1}. ${source.source} (Score: ${source.score.toFixed(3)})`);
        console.log(`   File: ${source.file}`);
        console.log(`   Text: ${source.text.substring(0, 200)}...`);
      });
      
      console.log(`\n⏱️  Processing time: ${processingTime}ms\n`);
      console.log('─'.repeat(80));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('');
    }
    
    askQuestion();
  });
};

// Start the CLI
askQuestion();