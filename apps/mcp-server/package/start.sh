#!/bin/bash
# XRPLens MCP Server — start script
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/server.js"
