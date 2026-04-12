# CorLens MCP Server

## What it does

The MCP server lets Claude (Desktop or Code) talk to CorLens directly. Instead of copy-pasting data into chat, the user asks Claude a question and Claude calls the CorLens API behind the scenes.

It exposes 7 tools:

| Tool | What it does | Auth needed? |
|------|-------------|--------------|
| `list_corridors` | Browse & filter 2,436 fiat corridors by region, status, currency | No |
| `get_corridor` | Get full detail for one corridor (actors, routes, AI note) | No |
| `get_partner_depth` | Live orderbook depth from Bitso or XRPL DEX | No |
| `ask_corridor` | Ask natural-language questions about corridors (RAG) | Yes |
| `analyze_address` | Launch Entity Audit on any XRPL address | Yes |
| `ask_analysis` | Ask questions about a completed audit (RAG) | Yes |
| `run_safe_path` | Run the Safe Path AI agent for cross-border payments | Yes |

## How it works

```
User asks Claude a question
        |
        v
Claude picks the right tool (e.g. list_corridors)
        |
        v
MCP server receives the tool call via stdio
        |
        v
MCP server calls the CorLens REST API (same API the web app uses)
        |
        v
Response goes back to Claude, who answers the user
```

The server runs locally on the user's machine as a Node.js subprocess. It communicates with Claude via **stdio** (standard input/output) using the Model Context Protocol. No ports, no web server, no Docker.

## Architecture

Everything is in one file: `src/index.ts` (~430 lines).

- **`.env` loader** (top of file) — reads a `.env` file next to the script so the zip package works without any setup beyond editing the file
- **`apiFetch()`** — generic HTTP wrapper that auto-detects token type (`xlens_...` = API key header, otherwise JWT bearer)
- **7 tool definitions** — each one is a `server.tool()` call with a Zod schema and an async handler
- **StdioServerTransport** — the MCP SDK handles all the protocol framing (newline-delimited JSON over stdio)

### Special tools

- **`analyze_address`** — starts an async analysis, then polls `/analyze/{id}/status` every 3s until done (120s timeout). Returns graph stats.
- **`run_safe_path`** — consumes an SSE stream from the API, collects all events (steps, tool calls, reasoning, crawled accounts), and formats the final verdict.

## Distribution: the zip package

Users download a zip from the docs page (`/corlens-mcp.zip`). The zip contains:

```
corlens-mcp/
  server.js     <- single bundled file (esbuild, ~725KB, no node_modules needed)
  .env          <- user puts their API key here
  start.sh      <- Mac/Linux launcher
  start.bat     <- Windows launcher
  README.md     <- setup instructions
```

### How to rebuild the zip

```bash
cd corlens/apps/mcp-server
npm run build:zip
cp corlens-mcp.zip ../web/public/corlens-mcp.zip
```

This runs `build-zip.mjs` which:
1. Bundles `src/index.ts` + all dependencies into a single CJS file with esbuild
2. Copies the package files (`.env`, `start.sh`, `start.bat`, `README.md`)
3. Zips everything into `corlens-mcp.zip`

### Why CJS bundle?

The source is ESM (`"type": "module"` in package.json), but the zip bundle is CJS. This is because users run it with `node server.js` — CJS works everywhere without needing a package.json with `"type": "module"` next to it.

## User setup flow

1. User goes to the docs page (`/docs?tab=mcp`)
2. Downloads `corlens-mcp.zip` (138KB)
3. Unzips anywhere on their computer
4. Opens `.env`, pastes their API key (`xlens_...`)
5. Adds to Claude config:
   - **Claude Code**: `claude mcp add corlens -- node /path/to/corlens-mcp/server.js`
   - **Claude Desktop**: adds JSON block to `claude_desktop_config.json`
6. Restarts Claude, asks a question

## Configuration

The server reads two env vars (from `.env` file or process environment):

| Variable | Default | Description |
|----------|---------|-------------|
| `CORLENS_API_KEY` | (empty) | `xlens_...` API key or JWT token |
| `CORLENS_API_URL` | `https://cor-lens.xyz/api` | API base URL (use `http://localhost:3001/api` for local dev) |

Process env always takes precedence over `.env` file values.

## Dev workflow

```bash
# Run locally during development (uses tsx, reads from process env)
CORLENS_API_URL=http://localhost:3001/api npm run dev

# Build TypeScript to dist/ (for the regular npm package)
npm run build

# Build the downloadable zip
npm run build:zip
```

## Testing

The MCP protocol uses newline-delimited JSON over stdio. To test manually:

```bash
# Start the server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js
```

Or use the test scripts in `/tmp/` (see the conversation history for full test scripts that test initialize, tools/list, and actual tool calls).

### Tested and verified

- MCP handshake (initialize + tools/list) — 7 tools registered
- `list_corridors` �� returns real corridor data with filters
- `get_corridor` — returns full corridor detail (USD-MXN: GREEN, 15 source actors)
- `ask_corridor` — RAG Q&A works with API key
- `analyze_address` — entity audit completes (84 nodes, 84 edges, 5 risk flags on RLUSD issuer)
