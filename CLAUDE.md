# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aperture is an AI-powered iOS app store screenshot automation tool. It allows developers to record one walkthrough on an iOS Simulator, then automatically replays it across multiple locales to generate store-ready screenshots in 30+ languages.

**Current Status:** Milestone 1 complete + US-023 (Automatic Appium Management) implemented. Core recording/playback functionality is functional.

**Tech Stack:**
- Runtime: Node.js + TypeScript
- Simulator Control: Appium XCUITest driver + WebDriverAgent + `xcrun simctl`
- Image Processing: Sharp
- AI: OpenAI GPT-4o-mini (parameterization, translations, element fallback)
- Web UI: Express + WebSocket
- CLI: Commander.js

## Architecture Overview

The system is designed as a modular CLI tool with the following core components:

### Core Modules (in `src/core/`)
- **AppiumManager**: ✅ Automatic Appium server lifecycle management with health checks and auto-recovery
- **DeviceManager**: ✅ Manages iOS Simulator lifecycle via `xcrun simctl` and WebDriverAgent sessions
- **Recorder**: ✅ Captures user actions and iOS accessibility tree during manual walkthroughs
- **Player**: ✅ Replays recordings deterministically with selector cascade and AI fallback
- **Parameterizer**: ⏳ Uses GPT-4o-mini to identify and parameterize locale-dependent text inputs (coming in M2)
- **LocaleManager**: ⏳ Switches Simulator locale via GlobalPreferences.plist manipulation (coming in M2)

### Supporting Modules
- **TemplateEngine** (`src/templates/`): Sharp-based image compositor for device frames and marketing overlays
- **TranslationService** (`src/translations/`): GPT-4o-mini-powered localized marketing copy generation
- **WebServer** (`src/web/`): Express + WebSocket server for browser-based recording UI
- **CLI** (`src/cli/`): Commander.js-based CLI with commands for each workflow step

### Data Flow Architecture

**Recording Flow:**
1. Connect to running iOS Simulator via WebDriverAgent
2. Install target .app bundle
3. Capture user actions (tap, type, scroll) with accessibility tree snapshots
4. User marks screenshot points
5. Save as `recordings/<name>.json`

**Parameterization Flow:**
1. Analyze recording text inputs via GPT-4o-mini
2. Interactive CLI confirmation of parameter suggestions
3. Save as `templates/<name>.json`

**Locale Generation Flow:**
1. Read parameters from template
2. Generate culturally appropriate test data for each configured locale via GPT-4o-mini
3. Save to `locales/<locale>.json`
4. Cache results (keyed by template hash + locale)

**Replay Flow:**
1. For each locale:
   - Switch Simulator locale (write plist → reboot → wait for ready)
   - Reset app (uninstall → install → launch)
   - Replay template with locale-specific parameters
   - Use selector cascade: accessibilityIdentifier → accessibilityLabel → label → xpath
   - Fall back to AI (GPT-4o-mini → GPT-4o) if selectors fail
   - Capture screenshots at marked points
   - Cache successful selector resolutions

**Export Flow:**
1. Composite raw screenshots with templates using Sharp
2. Apply device frames, backgrounds, and localized text overlays
3. Output store-ready PNGs at required dimensions (iPhone 6.5" 1242×2688, iPad 13" 2048×2732)

### Project Structure (Planned)

```
aperture/
├── src/
│   ├── index.ts                        # Main entry point
│   ├── types/                          # TypeScript type definitions
│   │   ├── recording.ts                # Recording, Step, ElementSelector, ScreenshotPoint
│   │   ├── template.ts                 # Template, Parameter
│   │   ├── locale.ts                   # LocaleData, LocaleConfig
│   │   ├── device.ts                   # SimulatorDevice, DeviceState
│   │   ├── player.ts                   # PlaybackResult, StepResult
│   │   └── errors.ts                   # Structured error types
│   ├── config/
│   │   ├── schema.ts                   # Zod schema for aperture.config.json
│   │   └── defaults.ts                 # Default config values
│   ├── utils/
│   │   ├── logger.ts                   # Structured logger (pino)
│   │   ├── exec.ts                     # Wrapper for xcrun commands
│   │   ├── retry.ts                    # Retry helper with exponential backoff
│   │   └── ai-client.ts               # OpenAI client singleton
│   ├── core/
│   │   ├── device-manager.ts           # Simulator lifecycle management
│   │   ├── recorder.ts                 # Action capture via WebDriverAgent
│   │   ├── player.ts                   # Step replay with AI fallback
│   │   ├── parameterizer.ts            # GPT-4o-mini parameterization
│   │   └── locale-manager.ts           # Simulator locale switching
│   ├── templates/
│   │   ├── template-engine.ts          # Sharp compositor
│   │   ├── styles/                     # Built-in template definitions
│   │   └── assets/                     # Device frames, fonts, backgrounds
│   ├── translations/
│   │   └── translation-service.ts      # Localized copy generation
│   ├── web/
│   │   ├── server.ts                   # Express app
│   │   ├── routes/                     # API endpoints and WebSocket handlers
│   │   └── frontend/                   # Static web UI
│   └── cli/
│       ├── index.ts                    # Commander.js program
│       ├── commands/                   # Individual CLI commands
│       └── ui.ts                       # CLI UI helpers (ora, chalk, prompts)
├── recordings/                         # User-created walkthroughs
├── templates/                          # Parameterized recordings
├── locales/                            # Locale-specific test data
├── translations/                       # Marketing copy per locale
├── output/                             # Raw screenshots from playback
├── export/                             # Final templated screenshots
├── cache/                              # Resolved selectors from AI runs
└── tests/
    ├── unit/                           # Unit tests
    ├── integration/                    # Integration tests (require Simulator)
    └── fixtures/                       # Test recordings and mock data
```

## Development Commands (Not Yet Implemented)

When the project is initialized, the following commands will be available:

```bash
# Project initialization
npm install
npm run build

# Development
npm run dev              # Watch mode with hot reload
npm run build            # Compile TypeScript to dist/

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests (require booted Simulator)

# Linting
npm run lint             # ESLint
npm run lint:fix         # Auto-fix linting issues
```

## CLI Commands (Planned)

```bash
# Setup
aperture init --app ./MyApp.app
aperture devices
aperture connect <device-udid>

# Recording
aperture record
aperture parameterize <recording>

# Locale management
aperture locales generate --locales en,de,fr,ja,ko
aperture locales add <locale>
aperture locales remove <locale>

# Execution
aperture play <recording>
aperture run <template> --locales all

# Export
aperture translations generate
aperture export <template> --style modern

# Web UI
aperture web

# Utilities
aperture import ./screenshots/
aperture config edit
```

## Key Technical Decisions

### Simulator Control Strategy
- **Primary:** `xcrun simctl` for all Simulator lifecycle operations (boot, shutdown, install, uninstall, locale changes, screenshots)
- **Interaction:** WebDriverAgent (via Appium XCUITest driver) for action execution and accessibility tree access
- **Rationale:** Native Apple tooling for device management, mature WebDriverIO client for interactions

### Element Location Strategy (Selector Cascade)
1. Try cached selector (from previous successful AI resolution)
2. Try `accessibilityIdentifier` (most stable)
3. Try `accessibilityLabel`
4. Try visible `label` text
5. Try XPath (last resort, fragile)
6. AI fallback: Accessibility tree → GPT-4o-mini
7. If GPT-4o-mini fails → GPT-4o
8. If GPT-4o fails → StepFailedError

### AI Usage
- **Parameterization:** GPT-4o-mini analyzes text inputs, suggests parameters
- **Locale Data:** GPT-4o-mini generates culturally appropriate test data
- **Translations:** GPT-4o-mini adapts marketing copy (not literal translation)
- **Element Fallback:** GPT-4o-mini → GPT-4o cascade for robustness
- **Verification:** Always deterministic (accessibility tree comparison), never LLM

### Error Handling
- **Structured errors:** All errors extend `ApertureError` with `code` and `context` fields
- **Per-step retries:** 2 retries with 1s delay before AI fallback
- **Run-level isolation:** Failed locales don't block other locales
- **Comprehensive logging:** Pino structured logs to stderr + `logs/<run-id>.json`

### Locale Switching
- **Mechanism:** Write to `/.GlobalPreferences.plist` via `plutil`, then `xcrun simctl shutdown` + `xcrun simctl boot`
- **Wait strategy:** Poll Simulator state until `Booted` (max 30s timeout)
- **App state:** Uninstall + reinstall app after locale switch for clean state

### Image Export
- **Library:** Sharp (native, fast, no browser dependency)
- **Composition layers:** Background → device frame → screenshot → text overlay
- **Target sizes:** iPhone 6.5" (1242×2688), iPad 13" (2048×2732)
- **Validation:** All exports must pass App Store Connect upload validation (PNG, RGB, no alpha, ≤ 8MB)

## Safety Guardrails

All runs enforce configurable limits (defined in `aperture.config.json`):
- `maxSteps`: Maximum actions per recording (default: 50)
- `stepTimeout`: Per-step element wait timeout (default: 10s)
- `runTimeout`: Total run timeout (default: 5min)
- `forbiddenActions`: Blocked actions (e.g., "delete account", "sign out of iCloud")

If any limit is exceeded, the run aborts with a clear error message.

## Multi-Simulator Pipeline (iPhone + iPad)

Per US-019, the export pipeline runs on two Simulators:
- **iPhone Simulator** (e.g., iPhone 14 Pro Max) → 6.5" screenshots (1242×2688)
- **iPad Simulator** (e.g., iPad Pro 13") → 13" screenshots (2048×2732)

If the iPhone recording fails on the iPad Simulator (due to UI differences), the system prompts the user to record a separate iPad walkthrough:
- Recordings stored as `recordings/<name>-iphone.json` and `recordings/<name>-ipad.json`
- Config supports per-device Simulator UDIDs: `{ "simulators": { "iphone": "<udid>", "ipad": "<udid>" } }`

## Dependencies (When Initialized)

Core runtime:
- `appium` + `webdriverio` (XCUITest driver for Simulator control)
- `sharp` (image compositing)
- `openai` (GPT API access)
- `commander` (CLI framework)
- `express` + `ws` (web server + WebSocket)
- `pino` (structured logging)
- `zod` (config schema validation)

Dev dependencies:
- `typescript` + `@types/*` packages
- `tsx` (TypeScript execution)
- `vitest` (testing framework)
- `eslint` + `prettier` (linting and formatting)

System dependencies (must be installed separately):
- Xcode (for `xcrun simctl` and iOS Simulators)
- WebDriverAgent (deployed to Simulator via Appium)
- Node.js 18+ (native `fetch`, ES modules)

## Documentation

- **PRD:** [docs/prd.md](docs/prd.md) — Complete product requirements with user stories, acceptance criteria, and technical architecture
- **README:** [README.md](README.md) — High-level overview and quick start guide

## Development Milestones

### M1 — Core Recording + Playback (4 weeks)
- US-001 to US-008: Simulator connection, app installation, recording, playback, screenshot capture, app reset, project config

### M2 — AI Parameterization + Localization (8 weeks)
- US-009 to US-016: Parameterization, locale data generation, locale switching, AI fallback, verification, batch execution, caching

### M3 — Templates + Export + Web UI (12 weeks)
- US-017 to US-022: Template application, translation generation, dual-simulator export, web recorder, template preview, screenshot import

## Automatic Appium Management (US-023)

The AppiumManager handles complete Appium server lifecycle automatically, eliminating the need for users to manually install, start, or manage Appium.

### Key Features

1. **Auto-detection and Installation**
   - Checks for local (`npx appium`) or global (`appium`) installation
   - Prompts user to install if missing
   - Installs Appium locally via `npm install --save-dev appium`
   - Automatically installs XCUITest driver

2. **Background Server Management**
   - Starts Appium in detached process mode (runs independently of CLI)
   - Uses `find-free-port` to avoid port conflicts (default: 8100, fallback: 8101-8110)
   - Saves server state to `.aperture/appium.state` for session persistence
   - Logs to `logs/appium-<timestamp>.log`

3. **Health Checks and Auto-Recovery**
   - HTTP health check to `http://localhost:<port>/status` before critical operations
   - `ensureHealthy()` method restarts server if unresponsive
   - Retry logic: 3 attempts with 2s backoff
   - Graceful fallback to manual mode with clear instructions

4. **Manual Control**
   - `aperture server start [--port <port>]` - Start server
   - `aperture server stop` - Stop server
   - `aperture server restart` - Restart server
   - `aperture server status` - Show status (running/stopped, port, PID, uptime)
   - `aperture server logs [-n <lines>]` - View logs
   - `aperture server install` - Install Appium manually

5. **Integration with Commands**
   - `aperture record` and `aperture play` automatically call `ensureHealthy()`
   - `--no-auto-appium` flag disables automatic management
   - `--appium-port <port>` overrides default port

### Implementation Details

**State Persistence:**
```json
{
  "pid": 12345,
  "port": 8100,
  "startTime": "2026-02-13T16:00:00Z",
  "logFile": "logs/appium-1707840000.log"
}
```

**Process Management:**
- Uses `spawn()` with `detached: true` and `unref()` to run server independently
- `tree-kill` for proper cleanup with SIGTERM signal
- Process PID verification with `process.kill(pid, 0)` before health checks

**Dependencies:**
- `find-free-port` - Port availability checking
- `tree-kill` - Process tree cleanup
- `appium` (devDependency) - XCUITest automation

## Notes for Implementation

### Interactive Setup (US-008)
The `aperture init` wizard uses `inquirer` or `prompts` to collect:
1. App path (.app/.ipa) → auto-detect bundle ID
2. Target locales (multi-select, default: `["en"]`)
3. Simulator selection (auto-detect via `simctl list`, default: latest iPhone + iPad)
4. Template style (5 built-in options, default: `modern`)
5. Output directory (default: `./output`)
6. Safety guardrails (max steps, timeouts)

Result saved to `aperture.config.json` in the current directory.

### Locale Configuration
The `locales` field in `aperture.config.json` is the single source of truth for target locales. All commands that operate on locales (generate, run, export) read from this config. Users can update locales via:
- `aperture config edit` (re-run wizard)
- `aperture locales add <locale,...>` (quick add)
- `aperture locales remove <locale,...>` (quick remove)

### Cache Invalidation
Selector caches in `cache/<template>/<locale>.json` are invalidated when the template file changes. The system computes a SHA-256 hash of the template JSON and stores it with cached selectors. On subsequent runs, if the hash mismatches, the cache is discarded and AI resolution runs fresh.

### Test Data Philosophy
AI-generated test data should be:
- **Culturally appropriate:** German locales use German names, Japanese locales use Japanese names
- **Realistic but generic:** Avoid real people or trademarked entities
- **Consistent within a locale:** Same `user_name` across all steps in a run
- **Editable:** Saved as JSON for manual overrides

### Verification Strategy
After each step, the system captures a new accessibility tree and verifies:
1. Expected screen/view controller is active (string match on view hierarchy)
2. Expected elements are present (element existence checks)
3. No unexpected error dialogs or overlays

Verification is **always deterministic** using tree comparison and string matching. LLMs are never used for verification to avoid non-deterministic false positives/negatives.
