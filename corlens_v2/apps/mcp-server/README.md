## @corlens/mcp-server

CorLens v2 MCP server. Exposes the v2 gateway as MCP tools over stdio.

Add to `claude_desktop_config.json` or `.claude/settings.json`:

```json
{
  "mcpServers": {
    "corlens": {
      "command": "node",
      "args": ["/path/to/corlens_v2/apps/mcp-server/dist/index.js"],
      "env": {
        "CORLENS_API_URL": "http://localhost:8080/api",
        "CORLENS_API_KEY": ""
      }
    }
  }
}
```

## Tools

- `list_corridors` — list 2,436 XRPL corridors
- `get_corridor` — full detail by id
- `ask_corridor` — RAG chat over corridor data
- `analyze_address` — entity audit on an XRPL r-address
- `ask_analysis` — RAG chat over a completed audit
- `run_safe_path` — Safe Path agent (SSE-collected verdict)

## Build

```bash
pnpm --filter @corlens/mcp-server run build
```
