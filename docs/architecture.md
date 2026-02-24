# MCP Architecture & Deployment Models

The Model Context Protocol (MCP) server defined in this project can be deployed in a few different ways, depending on how you want your agent to interact with the codebase. 

## 1. Local/Sidecar Deployment (Living alongside the Codebase)
*Most Common for AI Coding Assistants / Local CLI Agents*

In this model, the MCP server runs locally on the same machine (or same Docker container) as the codebase it is indexing.

**How it works:**
1. You run the server from within the codebase directory: `node codebase-indexer-mcp/build/index.js --path /Users/yihanhuang/my-project`
2. Connect the Agent: The agent (e.g., Cursor, a local terminal agent, or a custom script) connects to the MCP server via `stdio` (Standard Input/Output).
3. The MCP server reads the files directly from the local disk (`/Users/yihanhuang/my-project/*`), parses them into a local vector DB (like LanceDB stored in `.indexer/`), and waits for queries from the agent.

**Pros:** Fast, secure (no network traffic), perfect for local development.

## 2. Remote/Centralized Deployment (Living on a Server)
*Most Common for CI/CD, Enterprise Codebases, or Cloud Agents*

In this model, the MCP server is hosted on a remote server (like AWS, Railway, or an internal enterprise server) and indexes a codebase that lives on that server or is pulled from a remote repository (like GitHub).

**How it works:**
1. The server pulls down the repository (e.g., via `git clone https://github.com/org/repo.git`).
2. It runs the indexing process over those pulled files and stores the AST/Embeddings in a persistent database (like Pinecone or a mounted volume).
3. Connect the Agent: An agent (running anywhere in the world) connects to the MCP server over **HTTP/SSE** (Server-Sent Events) instead of `stdio`.
4. The agent sends API requests (e.g., `POST /mcp/query { "tool": "semantic_search", "args": { "query": "auth logic" } }`) over the network.

**Pros:** Allows lightweight agents (or web-based LLMs) to query massive codebases without having to download or process the code themselves.

## Does it "use a URL to read"?
Usually, **no**. The MCP server itself typically needs raw access to the file system (either locally on your laptop, or locally on the cloud server it's running on) because generating ASTs and embeddings requires reading the raw text of every `.ts`, `.py`, `.go`, etc. file. 

While you *could* build an MCP server that fetches files one-by-one via GitHub's API (using URLs), it would be incredibly slow and likely hit API rate limits when trying to index a large project. 

The standard approach is:
1. Agent -> asks MCP Server over `stdio` or `HTTP`
2. MCP Server -> reads local disk (or a cloned repo) to answer the agent.
