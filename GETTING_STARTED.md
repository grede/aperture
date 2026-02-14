# Getting Started with Aperture

## Prerequisites

Before using Aperture, ensure you have:

1. **macOS** with Xcode installed
2. **Node.js 20+**
3. **iOS Simulator** available in Xcode
4. **OpenAI API key** ([get one here](https://platform.openai.com/api-keys))
5. **mobile-mcp server** installed ([mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp))

## Installation

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

### Link CLI Globally (Optional)

To use `aperture` command globally:

```bash
npm run link
```

Or run directly:

```bash
node dist/cli/index.js <command>
```

## Quick Start

### 1. Check Available Simulators

```bash
aperture devices
```

This will list all available iOS Simulators on your system.

### 2. Initialize Your Project

```bash
aperture init
```

This interactive wizard will:
- Ask for your app path (`.app` bundle)
- Let you select target locales
- Choose iPhone and iPad simulators
- Set up guardrails (timeouts, cost caps)
- Generate `aperture.config.yaml` and `aperture-flow.yaml`

Use `--yes` flag to skip prompts and use defaults:

```bash
aperture init --yes --app ./build/MyApp.app
```

### 3. Define Your Flow

Edit `aperture-flow.yaml` to describe the screens you want to capture:

```yaml
app: ./build/MyApp.app

steps:
  - action: navigate
    instruction: "Dismiss any onboarding and get to the main screen"

  - action: screenshot
    label: "main_screen"

  - action: navigate
    instruction: "Open the settings screen"

  - action: screenshot
    label: "settings"
```

### 4. Set Your API Key

```bash
export OPENAI_API_KEY=sk-...
```

Or add it to your shell profile (`~/.zshrc` or `~/.bashrc`).

### 5. Run the Flow

Generate screenshots:

```bash
aperture run
```

Options:
- `--locale en-US` - Run for a single locale
- `--device iphone` - Run on iPhone only
- `--dry-run` - Preview actions without executing
- `--verbose` - Show detailed action logs

### 6. Check Output

Screenshots will be saved to:
```
./aperture-output/{locale}/{device}/{label}.png
```

Example:
```
./aperture-output/
  en-US/
    iphone/
      main_screen.png
      settings.png
    ipad/
      main_screen.png
      settings.png
  de/
    iphone/
      main_screen.png
      settings.png
```

## Using Variables

For locale-specific content, use `{{variables}}` in your flow:

**aperture-flow.yaml:**
```yaml
steps:
  - action: type
    text: "{{user_name}}"
```

**locales/en-US.yaml:**
```yaml
user_name: "John Smith"
```

**locales/de.yaml:**
```yaml
user_name: "Hans Müller"
```

## Examples

### Dry Run (Preview)

See what actions the AI will take without executing:

```bash
aperture run --dry-run
```

### Single Locale

Generate screenshots for one locale only:

```bash
aperture run --locale de
```

### Verbose Output

See detailed AI reasoning and actions:

```bash
aperture run --verbose
```

## Troubleshooting

### "MCP client is not connected"

Make sure `mobile-mcp` is installed and accessible:
```bash
which mobile-mcp
```

If not installed, follow: https://github.com/mobile-next/mobile-mcp

### "Environment variable OPENAI_API_KEY not set"

Set your API key:
```bash
export OPENAI_API_KEY=sk-...
```

### "Device not found"

Run `aperture devices` to see available simulators, then update `aperture.config.yaml` with valid device names.

### Build Errors

Clean and rebuild:
```bash
npm run clean
npm run build
```

## Development

### Watch Mode

Auto-rebuild on file changes:
```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
npm run lint:fix  # auto-fix issues
```

## What's Implemented (Milestone 1)

✅ **Core AI Navigation**
- Observe → Plan → Act → Verify loop
- LLM-driven navigation (GPT-4o-mini with GPT-4o escalation)
- MCP client for Simulator control

✅ **Flow Definition**
- YAML-based flow parser with Zod validation
- Variable resolution for locale-specific data
- Support for: navigate, screenshot, type, wait actions

✅ **Device Management**
- xcrun simctl wrapper
- Simulator boot/shutdown/install/launch
- Status bar normalization (9:41, full battery)

✅ **Safety & Cost Control**
- Action limits per step
- Timeouts (step + run level)
- Cost tracking with budget caps
- Forbidden action keywords

✅ **CLI Commands**
- `aperture init` - Interactive setup wizard
- `aperture run` - Execute flows
- `aperture devices` - List simulators

## Coming in Milestone 2

- Template engine (5 built-in styles)
- Locale switching
- AI-generated test data
- Localized marketing copy
- App Store export (exact dimensions)
- Batch execution across all locales

## Coming in Milestone 3

- Web UI for job management
- REST API
- Job queue (BullMQ + Redis)
- Simulator pool manager
- Multi-tenant support

## License

MIT
