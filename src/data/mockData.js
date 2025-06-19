// Mock data for testing when ChromaDB has issues
export const mockChunks = [
  {
    document: "Title: The Starry Night\nArtist: Vincent van Gogh\nCulture: Dutch\nDate: 1889\nMedium: Oil on canvas\nDescription: The Starry Night is an oil-on-canvas painting by Dutch Post-Impressionist painter Vincent van Gogh. This masterpiece showcases van Gogh's distinctive style with swirling clouds and vibrant colors.",
    metadata: {
      file: "1.json",
      chunk_index: 0,
      object_id: 1,
      title: "The Starry Night",
      artist: "Vincent van Gogh",
      culture: "Dutch",
      dated: "1889"
    },
    score: 0.85
  },
  {
    document: "Title: American Gothic\nArtist: Grant Wood\nCulture: American\nDate: 1930\nMedium: Oil on beaverboard\nDescription: American Gothic is a 1930 painting by Grant Wood. This iconic American painting depicts a farmer holding a pitchfork standing beside a woman in front of a house built in the American Gothic Revival style.",
    metadata: {
      file: "2.json",
      chunk_index: 0,
      object_id: 2,
      title: "American Gothic",
      artist: "Grant Wood",
      culture: "American",
      dated: "1930"
    },
    score: 0.82
  },
  {
    document: "Title: Cherry Blossoms Vase\nArtist: Unknown\nCulture: Japanese\nDate: Edo period (1603-1868)\nMedium: Ceramic with underglaze blue decoration\nDescription: A beautiful ceramic vase from the Edo period featuring delicate cherry blossom motifs painted in underglaze blue. The vase features traditional cherry blossom (sakura) patterns that are deeply symbolic in Japanese culture.",
    metadata: {
      file: "3.json",
      chunk_index: 0,
      object_id: 3,
      title: "Cherry Blossoms Vase",
      artist: "Unknown",
      culture: "Japanese",
      dated: "Edo period (1603-1868)"
    },
    score: 0.78
  },
  {
    document: "Title: Portrait of a Lady\nArtist: Mary Cassatt\nCulture: American\nDate: 1885\nMedium: Oil on canvas\nDescription: A portrait painting by American Impressionist artist Mary Cassatt, known for her paintings of women and children. Mary Cassatt was one of the few American artists to be associated with the French Impressionist movement.",
    metadata: {
      file: "4.json",
      chunk_index: 0,
      object_id: 4,
      title: "Portrait of a Lady",
      artist: "Mary Cassatt",
      culture: "American",
      dated: "1885"
    },
    score: 0.75
  },
  {
    document: "Title: Madonna and Child\nArtist: Fra Angelico\nCulture: Italian\nDate: c. 1440-1450\nMedium: Tempera on wood panel\nDescription: A religious painting depicting the Virgin Mary holding the infant Jesus Christ. Fra Angelico was known for his deeply spiritual religious paintings. This Madonna and Child demonstrates the transition from medieval to Renaissance art.",
    metadata: {
      file: "5.json",
      chunk_index: 0,
      object_id: 5,
      title: "Madonna and Child",
      artist: "Fra Angelico",
      culture: "Italian",
      dated: "c. 1440-1450"
    },
    score: 0.72
  }
];

export function searchMockData(query, topK = 5) {
  // Simple keyword-based search for demo purposes
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(' ');
  
  const scored = mockChunks.map(chunk => {
    const docLower = chunk.document.toLowerCase();
    let score = 0;
    
    keywords.forEach(keyword => {
      if (docLower.includes(keyword)) {
        score += 1;
      }
    });
    
    // Boost score for specific matches
    if (queryLower.includes('american') && docLower.includes('american')) score += 2;
    if (queryLower.includes('japanese') && docLower.includes('japanese')) score += 2;
    if (queryLower.includes('painting') && docLower.includes('painting')) score += 1;
    if (queryLower.includes('ceramic') && docLower.includes('ceramic')) score += 2;
    if (queryLower.includes('religious') && docLower.includes('religious')) score += 2;
    if (queryLower.includes('portrait') && docLower.includes('portrait')) score += 2;
    if (queryLower.includes('female') && docLower.includes('mary cassatt')) score += 2;
    if (queryLower.includes('19th century') && (docLower.includes('1889') || docLower.includes('1885'))) score += 2;
    
    return {
      ...chunk,
      score: score > 0 ? 0.9 - (score * 0.1) : 0.1 // Convert to distance-like score
    };
  });
  
  return scored
    .filter(chunk => chunk.score > 0.1)
    .sort((a, b) => a.score - b.score) // Lower score = better match
    .slice(0, topK);
}