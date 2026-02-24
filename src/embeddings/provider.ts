export interface EmbeddingProvider {
  /**
   * Generates a single array of floats representing the embedding of the given text.
   */
  getEmbeddings(text: string): Promise<number[]>;
  getEmbeddingsBatch(texts: string[]): Promise<number[][]>;
}
