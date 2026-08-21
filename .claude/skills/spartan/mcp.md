# Using the Spartan MCP server

`@spartan-ng/mcp` exposes current Spartan component documentation, APIs, examples, blocks, dependencies, accessibility guidance, health checks, and version-aware cache data.

## Configuration

```json
{
  "mcpServers": {
    "spartan-ui": {
      "command": "npx",
      "args": ["-y", "@spartan-ng/mcp"]
    }
  }
}
```

## Discovery tools

Use these before guessing component APIs:

- `spartan_components_list`
- `spartan_components_get` with API or code extraction
- `spartan_components_dependencies`
- `spartan_accessibility_check`
- `spartan_blocks_list`
- `spartan_blocks_get`
- `spartan_blocks_dependencies`
- `spartan_docs_get`
- `spartan_meta`
- `spartan_health_check`
- `spartan_health_instructions`
- `spartan_health_command`

The server also exposes component resources and prompts for implementation, API comparison, troubleshooting, and component discovery.

## Required agent flow

1. Confirm the component/API through MCP.
2. Inspect a working example.
3. Inspect dependencies and accessibility notes when relevant.
4. Add missing components through the Spartan CLI.
5. Adapt the copied Helm implementation to this repository's `DESIGN.md`, Relay tokens, RTL, i18n, and accessibility rules.

If MCP is unavailable, use the current Spartan docs and `@spartan-ng/cli:info --json`. Never guess selectors or undocumented inputs.