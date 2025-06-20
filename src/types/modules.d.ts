declare module "@huggingface/transformers" {
  export function pipeline(task: string, model: string): Promise<any>;
}

declare module "chromadb" {
  export class ChromaClient {
    constructor(options?: { path?: string });
    getOrCreateCollection(options: {
      name: string;
      embeddingFunction?: any;
    }): Promise<any>;
  }
}

declare module "winston" {
  export const createLogger: any;
  export const format: any;
  export const transports: any;
}
