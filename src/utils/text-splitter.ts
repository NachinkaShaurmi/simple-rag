export class TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = options.chunkSize;
    this.chunkOverlap = options.chunkOverlap;
  }

  splitText(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      const wordLength = word.length + 1;

      if (
        currentLength + wordLength > this.chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.join(" "));

        const overlapWords = [];
        let overlapLength = 0;
        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const w = currentChunk[i];
          if (overlapLength + w.length + 1 <= this.chunkOverlap) {
            overlapWords.unshift(w);
            overlapLength += w.length + 1;
          } else {
            break;
          }
        }

        currentChunk = overlapWords;
        currentLength = overlapLength;
      }

      currentChunk.push(word);
      currentLength += wordLength;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }
}
