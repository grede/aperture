# Aperture 📸

**Describe your app flow in plain English, get store-ready screenshots in 30+ languages.**

Aperture is an AI-powered CLI tool that automates App Store screenshot generation. Instead of manually clicking through every screen in every language, you write a simple YAML file describing what screens you want — and an AI agent navigates your app autonomously in the iOS Simulator.

## How It Works

1. **Describe your flow** in a YAML file:

```yaml
steps:
  - action: navigate
    instruction: "Open the main screen showing the list of groups"
  - action: screenshot
    label: "group_list"
  - action: navigate
    instruction: "Open the first group chat"
  - action: screenshot
    label: "group_chat"
```

2. **Run Aperture:**

```bash
aperture run
```

3. **Get store-ready screenshots** — composited with device frames, localized marketing copy, in every language you need, in exact App Store dimensions.

## The AI Agent

For each `navigate` step, Aperture's AI agent:
- Reads the current screen state (accessibility tree) via an MCP server
- Asks an LLM: *"Given this screen, how do I get to: [your instruction]?"*
- Executes the action (tap, type, scroll, swipe)
- Verifies the goal was reached
- Repeats until done — adapting to any UI state, onboarding flows, or layout differences

No brittle coordinate recording. No XPath selectors. Just plain English.

## Features

- 🤖 **AI Navigation** — Describe what you want, the agent figures out how
- 🌍 **30+ Languages** — Automatic locale switching, culturally appropriate test data
- 🖼️ **Store-Ready Output** — Device frames, marketing copy, exact App Store dimensions
- 🎨 **5 Template Styles** — Minimal, modern, gradient, dark, playful
- 💰 **Cost Controls** — Token tracking, cost caps, action limits per step
- 📱 **iPhone + iPad** — Same flow adapts to both layouts
- ⚡ **One Command** — `aperture init` → `aperture run` → done

## Quick Start

```bash
# Install
npm install -g aperture

# Set up your project
cd your-app
aperture init

# Generate screenshots
aperture run
```

## Requirements

- macOS with Xcode + iOS Simulator
- Node.js 20+
- OpenAI API key
- iOS Simulator MCP server

## Commands

| Command | Description |
|---------|-------------|
| `aperture init` | Interactive setup wizard |
| `aperture run` | Execute flow and capture screenshots |
| `aperture export` | Composite screenshots into store-ready images |
| `aperture generate-data` | Generate locale-specific test data |
| `aperture generate-copy` | Generate localized marketing copy |

## Architecture

```
CLI (Commander.js)
  ├── FlowParser          — YAML flow definitions
  ├── AINavigator         — LLM agent loop (observe → plan → act → verify)
  ├── MCPClient           — iOS Simulator control via MCP
  ├── DeviceManager       — Simulator lifecycle (simctl)
  ├── LocaleManager       — Locale switching
  ├── TemplateEngine      — Sharp-based image compositing
  ├── TranslationService  — Localized marketing copy
  └── LocaleDataGenerator — Culturally appropriate test data
```

## Documentation

- [Product Requirements Document](docs/prd.md)

## License

MIT
