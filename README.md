# Emmp Cedar — VS Code Extension

Cedar policy language support for the [Emmp](https://github.com/emmp-io) platform.

## Features

- **Syntax highlighting** for `.cedar` and `.cedarschema` files
- **Completions** with entity types, actions, and context attributes from your Emmp schema
- **Hover information** for Cedar keywords and schema-defined entities
- **Diagnostics** for common Cedar syntax issues
- **Policy simulation** against a connected Emmp instance (POST /api/cedar/simulate)
- **15 policy template snippets** covering data-protection, access-control, delegation, compliance, and operational categories
- **Connect wizard** for authenticating to an Emmp instance

## Installation

1. Install from the VS Code Marketplace (search for "Emmp Cedar")
2. Or build locally:
   ```bash
   npm install
   npm run build
   npm run package
   ```

## Connection Setup

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Emmp: Connect to Instance**
3. Enter your Emmp server URL, API key, and (optionally) tenant ID
4. The extension validates the connection by fetching the Cedar schema

## Commands

| Command | Description |
|---|---|
| `Emmp: Connect to Instance` | Connect to an Emmp server |
| `Emmp: Simulate Policy` | Simulate the active Cedar policy |
| `Emmp: Insert Policy Template` | Insert a policy template snippet |

## Snippets

All snippets use the `emmp-` prefix. Type `emmp-` in a `.cedar` file to see available templates.

## Configuration

| Setting | Description |
|---|---|
| `emmp.serverUrl` | Emmp instance URL |
| `emmp.tenantId` | Tenant ID |
