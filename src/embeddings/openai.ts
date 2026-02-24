import type { EmbeddingProvider } from "./provider.js";

export class OpenAIProvider implements EmbeddingProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    this.apiKey = key;
  }

  async getEmbeddings(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    return data.data?.[0]?.embedding || [];
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    const embeddings = data.data || [];
    // Ensure they are sorted by index
    embeddings.sort((a: any, b: any) => a.index - b.index);
    return embeddings.map((e: any) => e.embedding);
  }
}
