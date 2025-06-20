import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';
import type { ArtworkData } from '../types/index.js';

function countFiles(): void {
  try {
    const objectsDir = path.join(DATA_DIR, 'objects', '0');
    
    if (!fs.existsSync(objectsDir)) {
      console.log(`Directory ${objectsDir} does not exist`);
      return;
    }
    
    const files = fs.readdirSync(objectsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`📁 Data directory: ${objectsDir}`);
    console.log(`📄 Total files: ${files.length}`);
    console.log(`🗂️  JSON files: ${jsonFiles.length}`);
    
    if (jsonFiles.length > 0) {
      console.log('\n📋 Sample file structure:');
      const sampleFile = path.join(objectsDir, jsonFiles[0]);
      const sampleData: ArtworkData = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
      
      console.log('Available fields:');
      Object.keys(sampleData).forEach(key => {
        const value = (sampleData as any)[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`  - ${key}: (${type}) ${preview}`);
      });
    }
    
  } catch (error) {
    console.error('Error counting files:', (error as Error).message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  countFiles();
}

export { countFiles };