# 📸 Aperture

**AI-powered localized app store screenshot automation.**

Record one walkthrough → get store-ready screenshots in 30+ languages.

## The Problem

Indie developers and small teams manually capture screenshots for every language × every screen × every device size. It's a combinatorial nightmare that scales as `O(languages × screens × sizes)`.

## The Solution

Aperture lets you **record one walkthrough** on a local iOS Simulator, then **automatically replays** it for every locale. The AI agent handles test data, navigation, screenshots, design templates, and localized marketing copy — exporting store-ready assets.

**No XCUITest code required.** Unlike Fastlane snapshot (requires XCUITest scripts), Aperture uses an accessibility-tree-first approach with AI fallback — just click through your app once.

## How It Works

```
1. Record    →  Walk through your app once, mark screenshot points
2. Localize  →  AI generates culturally appropriate test data per locale
3. Replay    →  Automated playback across all configured languages
4. Export    →  Templated, store-ready PNGs in all required sizes
```

## Prerequisites

Before installing Aperture, ensure you have:

- **macOS** (required for iOS Simulator)
- **Xcode** 14.0+ with Command Line Tools installed
  ```bash
  xcode-select --install
  ```
- **Node.js** 18.0+ and npm
  ```bash
  node --version  # Should be >= 18.0.0
  ```

## Installation

### Global Installation (CLI Usage)

```bash
# Install Aperture globally
npm install -g aperture

# Build WebDriverAgent (required first-time setup)
npx appium driver run xcuitest build-wda

# Verify installation and check system requirements
aperture doctor
```

### Development Setup

```bash
# Clone and install dependencies
git clone https://github.com/your-org/aperture.git
cd aperture
npm install

# Build TypeScript
npm run build

# Build WebDriverAgent (REQUIRED - one-time setup)
npx appium driver run xcuitest build-wda

# Link for local development
npm link

# Verify setup (checks all requirements)
aperture doctor
```

**⚠️ Important:** The WebDriverAgent build step is **required** for Aperture to control the iOS Simulator. This only needs to be done once after installation.

## Quick Start

```bash
# Initialize project with interactive wizard
aperture init

# Record a walkthrough
aperture record

# Replay and capture screenshots
aperture play my-recording

# Generate locale data for 5 languages (coming soon - US-010)
aperture locales generate --locales en,de,fr,ja,ko

# Run across all locales and export (coming soon - US-014, US-017)
aperture run my-recording --locales all
aperture export my-recording --style modern
```

**Automatic Appium Management** — Aperture automatically installs, starts, and manages Appium server for you. After the one-time WebDriverAgent setup, no manual server management is needed! 🎉

For manual control:
```bash
aperture server start    # Start Appium manually
aperture server stop     # Stop Appium
aperture server status   # Check status
aperture server logs     # View logs
```

## Features

- 🎬 **Record & Replay** — Deterministic playback via iOS accessibility tree selectors
- 🌍 **30+ Languages** — Automatic locale switching, AI-generated test data & marketing copy
- 🤖 **AI Fallback** — GPT-4o-mini resolves UI elements when selectors break
- 🎨 **5 Built-in Templates** — `minimal` · `modern` · `gradient` · `dark` · `playful`
- 📱 **Store-Ready Export** — App Store dimensions (6.7", 6.5", 5.5" + iPad), device frames, localized text overlays
- 🖥️ **Web Recorder** — Browser-based recording with live Simulator preview
- ⚡ **Cached Runs** — Successful AI resolutions are cached for instant reruns

## Troubleshooting

### "Failed to connect to WebDriverAgent" Error

If you see errors about WebDriverAgent connection failures:

```bash
# Build WebDriverAgent (if not done during installation)
npx appium driver run xcuitest build-wda

# Verify Xcode Command Line Tools are installed
xcode-select -p

# If path is not set, install:
xcode-select --install
```

### "No route found for /wd/hub/session" Error

This indicates an Appium version mismatch. Ensure you're using Appium 2.x:

```bash
# Check installed version
npx appium --version

# Should show 2.x.x (not 3.x.x)
# If wrong version, reinstall dependencies:
rm -rf node_modules package-lock.json
npm install
npm run build
```

### WebDriverAgent Port Conflicts

If you see port 8100 conflicts:

```bash
# Check what's using port 8100
lsof -i :8100

# Kill any conflicting processes
kill <PID>

# Restart Aperture
aperture record
```

### Simulator Not Responding

```bash
# Reset the simulator
xcrun simctl shutdown all
xcrun simctl erase all

# Reboot and try again
aperture record
```

### View Detailed Logs

```bash
# Check Appium server logs for detailed error messages
aperture server logs
```

## Architecture

```
CLI (Commander.js)
  ├── AppiumManager      — Automatic Appium server lifecycle management
  ├── DeviceManager      — xcrun simctl + WebDriverAgent
  ├── Recorder           — Action capture + iOS accessibility tree
  ├── Player             — Deterministic replay + AI fallback
  ├── Parameterizer      — GPT-4o-mini text input analysis
  ├── LocaleManager      — Simulator locale switching via plist
  ├── TemplateEngine     — Sharp image compositing
  ├── TranslationService — Localized copy generation + cache
  └── WebServer          — Express + WebSocket for web UI
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Simulator Control:** Appium XCUITest driver + WebDriverAgent + `xcrun simctl`
- **Image Processing:** Sharp
- **AI:** OpenAI GPT-4o-mini (parameterization, translations, element fallback)
- **Web UI:** Express + WebSocket + Simulator mirroring
- **CLI:** Commander.js

## Roadmap

| Milestone | Scope | Timeline |
|-----------|-------|----------|
| **M1** | Core recording + playback (CLI, iOS Simulator) | 4 weeks |
| **M2** | AI parameterization + localization | 8 weeks |
| **M3** | Templates + export + web UI | 12 weeks |
| **v2** | Android support, cloud execution, CI/CD | Post-MVP |

## Docs

- [Product Requirements Document](docs/prd.md)

## License

MIT
