# Headless Codebase Indexer (MCP Server)

A minimalist, server-side codebase indexing tool built to give autonomous AI agents and language models the deep code-understanding capabilities typically reserved for visual IDEs like Cursor. 

**Why I built this:** When transitioning manual IDE workflows into fully autonomous, server-hosted processes, I hit a wall: unsupervised agents running in the cloud lack structural context. They try to `grep` their way through massive codebases and end up hallucinating or blowing out their context windows. 

Instead of deploying massive, heavy infrastructure, I wrote this lightweight tool to bridge that gap. It headlessly exposes both semantic meaning and strict AST structures via the Model Context Protocol (MCP), giving my automated agents the guardrails they need to navigate codebases securely and predictably.

### ⚙️ Core Architecture
- 🧠 **Semantic Search:** Fast vector embeddings via ChromaDB so agents can search by intent ("find authentication logic") rather than exact strings.
- 🏗️ **Structural Search:** Native AST / LSP parsing. Enables exact definitions, references, and full file token structures for TypeScript/JavaScript.
- ⏱️ **Zero-Block Indexing:** Background file ingestion so the event loop never freezes while your agents work.
- 🔄 **Live Cache Validation:** A built-in watcher (`chokidar`) instantly invalidates the AST cache when files change on disk. 
- 🔌 **Cloud / Local Ready:** Runs locally via StdIO for desktop clients (Claude), or securely over HTTP (SSE) behind Bearer token auth for remote pipelines.

---

## Getting Started

You will need the following dependencies:
1. **Node.js** (v18+)
2. **An API Key:** Set `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `VOYAGE_API_KEY` as an environment variable.
3. **ChromaDB:** A local vector database to store the code embeddings.

To start ChromaDB via Docker:
```bash
docker run -p 8000:8000 chromadb/chroma
```

### Local Setup (e.g., Claude Desktop)
Since this is an MCP server, it is typically launched by your AI client rather than run manually.

To connect it to Claude Desktop, open your configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac or `%APPDATA%\Claude\claude_desktop_config.json` on Windows) and add this configuration:

```json
{
  "mcpServers": {
    "codebase-indexer": {
      "command": "npx",
      "args": [
        "-y",
        "codebase-indexer-mcp",
        "<ABSOLUTE_PATH_TO_CODEBASE>"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-your-openai-key-here"
      }
    }
  }
}
```
*Note: Replace `OPENAI_API_KEY` with `GEMINI_API_KEY` or `VOYAGE_API_KEY` if you are using a different provider.*

### Cloud Setup (SSE / HTTP)
To host the indexer for remote agents, you can run it over HTTP by providing a `PORT` environment variable:

```bash
PORT=3000 API_KEY=your-secret-token npx codebase-indexer-mcp <ABSOLUTE_PATH_TO_CODEBASE>
```
Remote agents can then connect securely using the Bearer token (`your-secret-token`) at `http://localhost:3000/sse`.

---

## 🛠️ Use Cases

I don't build toys; I build tools to solve painful engineering problems. Here is how I actually use this in my day-to-day:

1. **Deterministic Refactoring**
   I pass the agent a high-level task. It uses `semantic_search` to map the neighborhood (e.g., finding the "billing provider"), and then strictly enforces `get_references` to track every upstream caller. It ensures cross-file edits are safe before opening a PR.

2. **Automated Code Reviews in CI/CD**
   A pipeline agent semantically verifies new pull requests against our existing architectural patterns. It leverages structural lookups to definitively prove that upstream dependencies weren't silently broken.

3. **Auditing Technical Debt**
   Instead of manually tracing legacy code, I deploy a background worker. It pulls the `get_file_structure` to outline massive legacy files, and traces deprecated API usage through exact AST definitions without ever running out of context.
