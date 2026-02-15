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
- Ask for a brief app description (used for AI-generated marketing copy)
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

## Generating Marketing Copy

After capturing screenshots, you can generate AI-powered marketing copy (titles and subtitles) for App Store presentation. This copy is localized for each target locale and follows App Store character limits.

### Prerequisites

Run `aperture run` first to generate screenshots:

```bash
aperture run
```

This creates screenshot files in `./aperture-output/{locale}/{device}/` that the generate-copy command will reference.

### Generate Copy

```bash
aperture generate-copy
```

The command will:

1. **Scan for screenshots**: Finds all `.png` files in the first locale's iPhone directory
2. **Use app description from config**: Reads `appDescription` from `aperture.config.yaml` (set during `aperture init`)
3. **Prompt for screenshot context**: For each screenshot label, asks what the screen shows (e.g., "Shows the group chat list with unread badges")
4. **Generate localized copy**: Uses your configured LLM model to create compelling marketing copy for each screenshot in each locale

**Override app description** (optional):
```bash
aperture generate-copy --description "A bill splitting app for groups"
```

### Interactive Prompts

```
✍️  Aperture Generate Marketing Copy

✔ Brief app description (for context): A social messaging app
Found 3 screenshot(s)

✔ Context for "main_screen": Shows the chat list with recent conversations
✔ Context for "group_chat": Shows a group conversation with media sharing
✔ Context for "settings": Shows customization options and privacy controls
```

### Output Files

Marketing copy is saved to `locales/{locale}-copy.yaml`:

**locales/en-US-copy.yaml:**
```yaml
main_screen:
  title: "Stay Connected"
  subtitle: "See all your conversations at a glance with real-time updates and unread badges"
group_chat:
  title: "Share Together"
  subtitle: "Create group chats for friends, family, or teams with instant photo and video sharing"
settings:
  title: "Your Privacy Matters"
  subtitle: "Customize your experience with powerful privacy controls and personalization options"
```

**locales/de-copy.yaml:**
```yaml
main_screen:
  title: "Bleib in Verbindung"
  subtitle: "Alle deine Unterhaltungen auf einen Blick mit Echtzeit-Updates und Ungelesen-Markierungen"
group_chat:
  title: "Gemeinsam Teilen"
  subtitle: "Erstelle Gruppenchats für Freunde, Familie oder Teams mit sofortigem Foto- und Video-Austausch"
settings:
  title: "Deine Privatsphäre Zählt"
  subtitle: "Passe dein Erlebnis mit leistungsstarken Datenschutzkontrollen und Personalisierungsoptionen an"
```

### Options

```bash
# Generate copy for specific locale only
aperture generate-copy --locale de

# Regenerate copy for all locales (overwrite existing files)
aperture generate-copy --regenerate

# Use a different model (override config)
aperture generate-copy --model gpt-4o

# Override app description
aperture generate-copy --description "A productivity app for teams"

# Combine options
aperture generate-copy --locale en-US --regenerate --model gpt-4o
```

### Character Limits

The AI respects visual display constraints:
- **Title**: ≤ 30 characters (recommended for readability)
- **Subtitle**: ≤ 80 characters (optimized for 2-line display)

If limits are exceeded, you'll see a warning and can regenerate with `--regenerate`.

**Note**: The subtitle limit is intentionally stricter than App Store Connect's 170-character technical limit to ensure text fits nicely on 2 lines in the rendered screenshots.

### Using Generated Copy

The copy files will be used with the `aperture export` command (coming in Milestone 2) to composite screenshots with device frames and marketing text for App Store submission.

### Skip Existing Files

By default, the command skips locales that already have copy files:

```
⏭  en-US-copy.yaml already exists (use --regenerate to overwrite)
```

Use `--regenerate` to overwrite existing files.

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

### Complete Workflow

Full workflow from screenshots to marketing copy:

```bash
# 1. Generate screenshots for all locales
aperture run

# 2. Generate AI-powered marketing copy
aperture generate-copy

# 3. View output
ls locales/*-copy.yaml
```

### Regenerate Copy for One Locale

Update marketing copy for a specific locale:

```bash
aperture generate-copy --locale ja --regenerate
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
- `aperture generate-copy` - AI-generated marketing copy

✅ **Localization**
- AI-powered marketing copy generation
- Multi-locale support (37 App Store locales)
- Culturally appropriate copy for each target market

## Coming in Milestone 2

- Template engine (5 built-in styles)
- `aperture export` - Composite screenshots into store-ready images
- Locale switching with Simulator reboot
- AI-generated test data (`aperture generate-data`)
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
