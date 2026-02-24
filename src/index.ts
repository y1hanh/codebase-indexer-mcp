#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import { SemanticIndexer } from "./semantic.js";
import { StructuralIndexer } from "./structural.js";
import { GeminiProvider } from "./embeddings/gemini.js";
import { OpenAIProvider } from "./embeddings/openai.js";
import { VoyageProvider } from "./embeddings/voyage.js";
import * as dotenv from "dotenv";

dotenv.config();

const serverArgs = process.argv.slice(2);
const targetDir = serverArgs[0] || process.cwd();

// Determine which API to use based on env vars
let provider: any;
if (process.env.OPENAI_API_KEY) {
  provider = new OpenAIProvider();
} else if (process.env.VOYAGE_API_KEY) {
  provider = new VoyageProvider();
} else {
  // Defaults to Gemini and will throw error gracefully if not set
  provider = new GeminiProvider();
}

const server = new McpServer({
  name: "headless-codebase-indexer",
  version: "1.0.0",
});

const indexer = new SemanticIndexer(targetDir, provider);
const structuralIndexer = new StructuralIndexer(targetDir);

server.tool("semantic_search",
  "Search the codebase for code snippets based on semantic meaning or natural language description.",
  {
    query: z.string().describe("The natural language query describing the code you are looking for."),
    limit: z.number().default(5).describe("Number of top results to return."),
  },
  async ({ query, limit }) => {
    try {
      const results = await indexer.search(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Semantic search failed: ${e.message}` }], isError: true };
    }
  }
);

server.tool("get_definition",
  "Get the location where a symbol is defined, using strict TypeScript analysis.",
  {
    filePath: z.string().describe("Absolute path to the TypeScript file"),
    line: z.number().describe("1-indexed line number of the symbol"),
    character: z.number().describe("1-indexed character position on the line"),
  },
  async ({ filePath, line, character }) => {
    try {
      const results = structuralIndexer.getDefinition(filePath, line, character);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool("get_references",
  "Find all usages/references of a symbol across the entire TypeScript project.",
  {
    filePath: z.string().describe("Absolute path to the TypeScript file"),
    line: z.number().describe("1-indexed line number of the symbol"),
    character: z.number().describe("1-indexed character position on the line"),
  },
  async ({ filePath, line, character }) => {
    try {
      const results = structuralIndexer.getReferences(filePath, line, character);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool("get_file_structure",
  "Get the AST outline of a file (classes, functions, interfaces, constants).",
  {
    filePath: z.string().describe("Absolute path to the TypeScript file"),
  },
  async ({ filePath }) => {
    try {
      const results = structuralIndexer.getFileStructure(filePath);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

server.tool("index_codebase",
  "Recursively index the entire codebase directory for semantic search. Do this if semantic_search is returning empty or missing results.",
  {
    dirPath: z.string().optional().describe("Optional path to index. Defaults to the starting target directory.")
  },
  async ({ dirPath }) => {
    try {
      const dirToIndex = dirPath || targetDir;
      // Start in background to avoid blocking MCP timeout, and return acceptance
      indexer.indexDirectory(dirToIndex).catch(e => console.error("Background indexing error:", e));
      return { content: [{ type: "text", text: `Started background indexing of ${dirToIndex}. It may take a few minutes depending on the size of the project.` }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

async function run() {
  await indexer.initialize();
  await structuralIndexer.initialize();
  // Here we could recursively scan targetDir to populate indexer, but for startup speed 
  // we might want to do it selectively or in the background
  console.error(`Indexing codebase at: ${targetDir}`);
  console.error(`Using embedding provider: ${provider.constructor.name}`);
  
  if (process.env.PORT) {
    const app = express();
    const port = parseInt(process.env.PORT, 10);
    
    // Add simple Bearer token authentication if API_KEY is set
    if (process.env.API_KEY) {
      app.use((req, res, next) => {
        const auth = req.headers.authorization;
        if (!auth || auth !== `Bearer ${process.env.API_KEY}`) {
          res.status(401).send("Unauthorized: Missing or invalid exact API_KEY match");
          return;
        }
        next();
      });
    }

    const transport = new StreamableHTTPServerTransport();
    await server.connect(transport as any);
    
    app.all("/sse", async (req, res) => {
      await transport.handleRequest(req, res);
    });
    
    app.listen(port, () => {
      console.error(`Headless Codebase Indexer MCP server running on http://localhost:${port}/sse`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Headless Codebase Indexer MCP server running on stdio");
  }
}

run().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
