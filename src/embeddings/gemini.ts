import type { EmbeddingProvider } from "./provider.js";

export class GeminiProvider implements EmbeddingProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    this.apiKey = key;
  }

  async getEmbeddings(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    return data.embedding?.values || [];
  }

  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] }
        }))
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error: ${response.statusText} - ${err}`);
    }

    const data = (await response.json()) as any;
    return (data.embeddings || []).map((e: any) => e.values || []);
  }
}
