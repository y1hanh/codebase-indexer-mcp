import type { EmbeddingProvider } from "./provider.js";

export class VoyageProvider implements EmbeddingProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.VOYAGE_API_KEY;
    if (!key) throw new Error("VOYAGE_API_KEY is not set");
    this.apiKey = key;
  }

  async getEmbeddings(text: string): Promise<number[]> {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: [text],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Voyage API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    return data.data?.[0]?.embedding || [];
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: texts,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Voyage API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    const embeddings = data.data || [];
    // Voyage returns them sorted by input index normally, mapping over the array
    return embeddings.map((e: any) => e.embedding);
  }
}
