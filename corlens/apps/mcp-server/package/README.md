# CorLens MCP Server

Connect Claude to CorLens — browse corridors, run entity audits, query RAG, and check live DEX depth through natural conversation.

## Setup (3 steps)

### 1. Add your API key

Open the `.env` file in this folder and replace `xxxxxx` with your CorLens API key:

```
CORLENS_API_KEY=xlens_paste_your_key_here
```

You can get an API key from your CorLens account page: https://corlens.dev/account

### 2. Add to Claude

**Claude Code (CLI):**

```bash
claude mcp add corlens -- node /full/path/to/corlens-mcp/server.js
```

**Claude Desktop:**

Open Settings > Developer > Edit Config and add:

```json
{
  "mcpServers": {
    "corlens": {
      "command": "node",
      "args": ["/full/path/to/corlens-mcp/server.js"],
      "env": {
        "CORLENS_API_KEY": "xlens_paste_your_key_here"
      }
    }
  }
}
```

Replace `/full/path/to/corlens-mcp/server.js` with the actual path where you unzipped this folder.

### 3. Try it

Open Claude and ask:

- "List all GREEN corridors in LATAM"
- "What's the safest USD to MXN corridor right now?"
- "Run a safe path analysis for 5000 USD to EUR"
- "Audit the RLUSD issuer address"
- "What's the live spread on EUR/XRP via GateHub?"

## Requirements

- **Node.js** v18 or later — check with `node --version`
- **Claude Desktop** or **Claude Code**

## Available tools

| Tool | Description |
|------|-------------|
| `list_corridors` | Browse & filter 2,436 fiat corridors |
| `get_corridor` | Full detail for one corridor |
| `ask_corridor` | RAG Q&A on corridor data |
| `analyze_address` | Launch Entity Audit on any XRPL address |
| `ask_analysis` | RAG Q&A on audit results |
| `run_safe_path` | AI agent for cross-border payment compliance |
| `get_partner_depth` | Live DEX/exchange orderbook depth |

## Troubleshooting

- **"Cannot find module"**: Make sure you have Node.js v18+ installed
- **"401 Unauthorized"**: Check your API key in `.env`
- **Claude says "I don't have access to..."**: Restart Claude after adding the config
