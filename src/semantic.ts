import { ChromaClient, type Collection } from "chromadb";
import * as fs from "fs";
import * as path from "path";
import type { EmbeddingProvider } from "./embeddings/provider.js";

const chroma = new ChromaClient(); 

export class SemanticIndexer {
  private collectionName = "codebase_index";
  private collection: Collection | null = null;
  private targetPath: string;
  private embeddingProvider: EmbeddingProvider;

  constructor(targetPath: string, embeddingProvider: EmbeddingProvider) {
    this.targetPath = targetPath;
    this.embeddingProvider = embeddingProvider;
  }

  async initialize() {
    try {
      this.collection = await chroma.getOrCreateCollection({
        name: this.collectionName,
        metadata: { "hnsw:space": "cosine" }
      });
      console.error(`Connected to ChromaDB collection: ${this.collectionName}`);
    } catch (e) {
      console.error("Failed to connect to ChromaDB. Ensure it is running.");
      throw e;
    }
  }

  private chunkText(text: string, chunkSize: number = 50): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      chunks.push(lines.slice(i, i + chunkSize).join('\n'));
    }
    return chunks;
  }

  public async indexFile(filePath: string) {
    if (!this.collection) throw new Error("ChromaDB not initialized");
    
    const content = await fs.promises.readFile(filePath, "utf-8");
    const chunks = this.chunkText(content);
    
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchIds = batchChunks.map((_, idx) => `${filePath}#chunk${i + idx}`);
      const batchMetadatas = batchChunks.map((_, idx) => ({ source: filePath, chunkIndex: i + idx }));

      try {
        const batchEmbeddings = await this.embeddingProvider.getEmbeddingsBatch(batchChunks);
        
        await this.collection.upsert({
          ids: batchIds,
          embeddings: batchEmbeddings,
          documents: batchChunks,
          metadatas: batchMetadatas
        });
      } catch (err) {
        console.error(`Failed to index chunk batch in ${filePath}:`, err);
      }
    }
    console.error(`Indexed ${filePath} (${chunks.length} chunks)`);
  }

  public async indexDirectory(dir: string) {
    let list: fs.Dirent[];
    try {
      list = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    
    for (const file of list) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
         if (["node_modules", ".git", "dist", "build", "coverage"].includes(file.name)) continue;
         await this.indexDirectory(fullPath);
      } else if (file.isFile() && /\.(ts|tsx|js|jsx)$/.test(file.name)) {
         await this.indexFile(fullPath);
      }
    }
  }

  public async search(query: string, nResults: number = 5) {
    if (!this.collection) throw new Error("ChromaDB not initialized");

    const queryEmbedding = await this.embeddingProvider.getEmbeddings(query);
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: nResults
    });

    return results;
  }
}
