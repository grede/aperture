# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aperture** is an AI-powered CLI tool that automates App Store screenshot generation for iOS apps. Developers describe their app flow in YAML using plain English instructions, and an AI agent autonomously navigates the app in the iOS Simulator to capture screenshots in 30+ languages with store-ready templates.

**Current Status**: V2 architecture redesign in progress. The project pivoted from record-and-replay (Appium/WebDriverIO) to AI-first navigation using MCP (Model Context Protocol) and LLMs. The codebase has been cleared, retaining only documentation. Implementation of Milestone 1 (Core AI Navigation + Screenshot Capture) is the immediate next phase.

## Core Architecture (V2 - AI Agent Approach)

### High-Level Components

```
CLI (Commander.js)
  ├── FlowParser                  — YAML flow definitions → structured steps
  ├── AINavigator                 — LLM agent loop (observe → plan → act → verify)
  ├── Provider Abstraction Layer  — Pluggable mobile automation backends
  │   ├── IMobileAutomationProvider (interface)
  │   ├── MobileMCPProvider       — Adapter for @mobilenext/mobile-mcp
  │   ├── ProviderFactory         — Provider creation and registry
  │   └── (Future: Appium, Maestro, etc.)
  ├── DeviceManager               — Simulator lifecycle (boot, install, launch via xcrun simctl)
  ├── LocaleManager               — Locale switching (plist manipulation + reboot)
  ├── TemplateEngine              — Sharp-based image compositing (device frames + marketing text)
  ├── TranslationService          — Localized marketing copy generation (LLM)
  └── LocaleDataGenerator         — Culturally appropriate test data (LLM)
```

**Provider Abstraction**: Aperture uses the Adapter pattern to support multiple mobile automation backends. All automation operations (tap, type, screenshot, etc.) go through the `IMobileAutomationProvider` interface, allowing easy switching between MCP servers, Appium, Maestro, or custom implementations. See `src/core/providers/README.md` for details.

### Planned Directory Structure

```
aperture/
├── src/
│   ├── cli/
│   │   ├── index.ts              # Commander.js entry point
│   │   ├── commands/
│   │   │   ├── init.ts           # Setup wizard
│   │   │   ├── run.ts            # Flow execution
│   │   │   ├── export.ts         # Template compositing + export
│   │   │   ├── generate-data.ts  # Locale test data generation
│   │   │   └── generate-copy.ts  # Marketing copy generation
│   │   └── ui/
│   │       ├── prompts.ts        # Inquirer.js prompts
│   │       └── progress.ts       # Progress display
│   ├── core/
│   │   ├── flow-parser.ts        # YAML parsing + validation
│   │   ├── ai-navigator.ts       # LLM agent loop
│   │   ├── providers/            # Mobile automation provider abstraction
│   │   │   ├── mobile-automation-provider.ts  # Core interface
│   │   │   ├── mobile-mcp-provider.ts         # MCP adapter
│   │   │   ├── provider-factory.ts            # Provider registry
│   │   │   ├── index.ts                       # Public exports
│   │   │   └── README.md                      # Provider documentation
│   │   ├── mcp-client.ts         # Legacy MCP client (kept for reference)
│   │   ├── device-manager.ts     # xcrun simctl wrapper
│   │   ├── locale-manager.ts     # Locale switching
│   │   └── cost-tracker.ts       # Token usage + cost tracking
│   ├── templates/
│   │   ├── engine.ts             # Sharp compositing pipeline
│   │   ├── styles/               # 5 built-in style definitions
│   │   └── assets/               # Device frames, fonts
│   ├── localization/
│   │   ├── translation-service.ts
│   │   └── locale-data-generator.ts
│   ├── types/
│   │   └── index.ts              # Shared type definitions
│   └── server/                   # Milestone 3 (web service)
│       ├── app.ts                # Express server
│       ├── routes/
│       ├── queue/                # BullMQ workers
│       └── pool/                 # Simulator pool manager
├── templates/
│   └── assets/                   # Device frame PNGs, fonts
├── docs/
│   └── prd.md                    # Product Requirements Document
├── aperture.config.yaml          # Example config
├── aperture-flow.yaml            # Example flow
├── package.json
└── tsconfig.json
```

## Development Commands

**Note**: Many of these commands are not yet implemented. Once the codebase is built out:

### Build & Development
```bash
npm run dev          # Watch mode development
npm run build        # TypeScript compilation
npm run typecheck    # Type checking without build
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix linting issues
npm run format       # Prettier formatting
```

### Testing
```bash
npm test             # Run all tests
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests only
```

### CLI Usage (Planned)
```bash
aperture init                           # Interactive setup wizard
aperture run                            # Execute flow for all locales/devices
aperture run --locale en-US             # Single locale
aperture run --device iphone            # iPhone only
aperture run --dry-run                  # Show planned actions without executing
aperture export                         # Composite screenshots into store-ready images
aperture generate-data                  # Generate locale-specific test data
aperture generate-copy                  # Generate localized marketing copy
aperture devices                        # List available iOS Simulators
aperture devices --booted               # Show only booted devices
```

## Key Technical Decisions

### MCP Server Integration
- **Server**: [`mobile-next/mobile-mcp`](https://github.com/mobile-next/mobile-mcp)
- **Primary Mode**: Accessibility tree snapshots (no computer vision needed)
- **Fallback Mode**: Screenshot-based coordinate taps when accessibility labels unavailable
- **Capabilities**:
  - `get_accessibility_tree()` — full UI hierarchy
  - `tap(element_id)` and `tap(x, y)` — element or coordinate-based interaction
  - `type(text)`, `scroll(direction)`, `swipe(...)`, `press_button(...)`
  - `take_screenshot()`, `get_screen_info()`
  - App lifecycle: install, launch, terminate, uninstall

### AI Navigator Loop (Core Innovation)
For each `navigate` step in the flow:
1. **Observe**: Fetch accessibility tree from MCP server
2. **Plan**: Send tree + instruction to LLM → receive single action (tap, type, scroll, swipe)
3. **Act**: Execute action via MCPClient
4. **Verify**: Fetch new tree, ask LLM "Has the goal been reached?" (yes/no + reasoning)
5. **Loop** until goal verified or max actions reached

**LLM Strategy**:
- Default: GPT-4o-mini (fast, cheap)
- Escalation: GPT-4o after 5 failed attempts on a single step
- Each call includes system prompt with: available actions, current instruction, action history

### Guardrails & Safety
- **Max actions per step**: 10 (default)
- **Step timeout**: 60s
- **Run timeout**: 600s (10 min)
- **Cost cap**: $5.00/run
- **Forbidden actions**: Configurable keyword blocklist (e.g., "delete", "remove")
- Token usage tracked per LLM call, cost estimated in real-time

### Flow Definition (YAML)
Simple, human-readable format:
```yaml
app: ./build/MyApp.app
steps:
  - action: navigate
    instruction: "Dismiss any onboarding dialogs and get to the main screen"

  - action: screenshot
    label: "group_list"

  - action: navigate
    instruction: "Open the group called '{{group_name}}'"

  - action: type
    text: "{{user_name}}"

  - action: wait
    duration: 2
```

**Variable Substitution**: `{{variable}}` syntax resolved from `locales/{locale}.yaml` files before execution.

### Locale Switching
- Writes `AppleLanguages` and `AppleLocale` to Simulator's `GlobalPreferences.plist`
- Requires Simulator reboot for iOS to pick up changes
- Supports all 37 App Store Connect locales

### Template System
5 built-in styles (Sharp-based compositing):
- **minimal**: White background, thin frame, text below
- **modern**: Gradient background, floating device with shadow
- **gradient**: Bold gradient, angled device, large text overlay
- **dark**: Dark background, glowing edges, light text
- **playful**: Colorful shapes, rotated device, fun fonts

**Output**: PNG/JPEG in exact App Store dimensions (iPhone 6.5": 1242×2688px, iPad 13": 2048×2732px)

## Configuration Files

### `aperture.config.yaml`
```yaml
# App configuration - Option 1: Install fresh each run (default)
app: ./build/MyApp.app
bundleId: com.example.myapp
# installApp: true  # Optional: defaults to true

# Option 2: Use existing app (preserves app state like pre-seeded data, logged-in users)
# bundleId: com.example.myapp
# installApp: false  # Skip installation, launch existing app

flow: ./aperture-flow.yaml

locales:
  - en-US
  - de
  - ja
  - pt-BR

devices:
  iphone: "iPhone 15 Pro Max"
  ipad: "iPad Pro (13-inch) (M4)"

template:
  style: modern

output: ./aperture-output

guardrails:
  maxActionsPerStep: 10
  stepTimeoutSec: 60
  runTimeoutSec: 600
  costCapUsd: 5.00
  forbiddenActions: []

llm:
  apiKey: ${OPENAI_API_KEY}
  defaultModel: gpt-4o-mini
  escalationModel: gpt-4o
  escalateAfterAttempts: 5

mcp:
  endpoint: stdio://mobile-mcp
```

**App Installation Modes**:
- **Install Mode** (default): `installApp: true` or omitted. Installs app from `app` path each run. Use for clean app state.
- **Existing App Mode**: `installApp: false`. Launches already-installed app by `bundleId`. Use to preserve app state (pre-seeded data, logged-in users, specific configurations). The `app` field is optional in this mode.

### Locale Data Files (`locales/{locale}.yaml`)
```yaml
user_name: "Müller"
group_name: "Familiengruppe"
search_query: "Nachrichten suchen"
```

## Implementation Priorities (Milestones)

### Milestone 1: Core AI Navigation + Screenshot Capture
**Status**: Not started (documentation-only phase)

**Key User Stories**:
- US-1.01: Flow Definition (YAML parser + validation)
- US-1.02: MCP Server Integration (mobile-mcp client)
- US-1.03: AI Navigator (observe → plan → act → verify loop)
- US-1.04: Screenshot Capture (MCP take_screenshot + status bar normalization)
- US-1.05: Device Management (xcrun simctl wrapper)
- US-1.06: Setup Wizard (`aperture init`)
- US-1.07: Guardrails (action limits, timeouts, cost cap)
- US-1.08: CLI Runner (`aperture run`)

### Milestone 2: Localization + Templates + Export
- Locale switching (plist manipulation)
- Parameterized flows (variable resolution)
- AI-generated locale test data
- Batch execution (all locales × all devices)
- Template engine (5 built-in styles)
- Localized marketing copy generation
- App Store export (exact dimensions)

### Milestone 3: Web Service
- Web UI for job management
- REST API for programmatic access
- BullMQ job queue with Redis
- Simulator pool manager (concurrent jobs)
- Session management and resource cleanup

## Dependencies (Planned)

| Package | Purpose | Version |
|---------|---------|---------|
| `commander` | CLI framework | ^12.x |
| `inquirer` | Interactive prompts | ^9.x |
| `yaml` | YAML parsing | ^2.x |
| `zod` | Schema validation | ^3.x |
| `sharp` | Image compositing | ^0.33.x |
| `openai` | LLM API client | ^4.x |
| `@modelcontextprotocol/sdk` | MCP client SDK | ^1.x |
| `ora` | CLI spinners | ^8.x |
| `chalk` | Terminal colors | ^5.x |
| `plist` | Property list read/write | ^3.x |
| `express` | HTTP server (M3) | ^4.x |
| `bullmq` | Job queue (M3) | ^5.x |
| `ioredis` | Redis client (M3) | ^5.x |
| `ws` | WebSocket (M3) | ^8.x |
| `typescript` | Language | ^5.x |
| `vitest` | Testing | ^2.x |
| `tsup` | Bundling | ^8.x |

## Error Recovery Strategy

When the AI navigator fails a step:
1. Log failure with full context (accessibility tree, action history)
2. **Continue** to next step (don't abort entire run)
3. Mark screenshot as missing in final report
4. Suggest instruction improvements in error output

| Error Type | Handling |
|------------|----------|
| MCP connection failure | Retry 3× with exponential backoff (1s, 2s, 4s), then abort |
| MCP call timeout | Retry once, then fail current step |
| LLM API rate limit | Retry with backoff up to 3× |
| LLM API auth error | Abort immediately with clear message |
| Navigate step fails (max actions) | Log warning, mark failed, continue |
| Cost cap exceeded | Abort run, print summary of completed steps |
| Simulator crash | Attempt reboot, abort if fails |
| App crash during flow | Detect via empty accessibility tree, relaunch app, retry step once |

## Performance Targets

| Metric | Target |
|--------|--------|
| Single navigate step (avg) | < 15 seconds (3–5 LLM round trips) |
| Screenshot capture | < 2 seconds |
| Full flow (5 screenshots, 1 locale, 1 device) | < 3 minutes |
| Full batch (5 screenshots, 10 locales, 2 devices) | < 60 minutes |
| Template compositing per image | < 500ms |
| Locale switch + reboot | < 20 seconds |

## Development Notes

### V1 → V2 Transition
- **V1** (commits up to a684227): Used Appium/WebDriverIO for record-and-replay automation
- **V2** (current): AI-agent-based approach using MCP + LLMs
- Codebase cleared in commit a684227 ("v2: AI agent approach — describe flows in plain text, AI navigates")
- All implementation now follows docs/prd.md specifications

### Resolved Design Questions
- **OQ-1**: MCP server → `mobile-next/mobile-mcp` ✅
- **OQ-3**: Screenshot fallback → Yes, when accessibility unavailable ✅
- **OQ-5**: Auth/login → Pre-configure credentials in flow YAML via `{{variables}}` ✅
- **OQ-7**: Device frames → Use license-free frames (Facebook Design resources or CC0 assets) ✅
- **OQ-10**: Dry-run mode → Implement `--dry-run` in M1 for flow validation ✅

### Requirements
- macOS with Xcode + iOS Simulator
- Node.js 20+
- OpenAI API key (set as `OPENAI_API_KEY` environment variable)
- iOS Simulator MCP server (`mobile-mcp`)

## Code Style Guidelines

- TypeScript strict mode enabled
- Use Zod for runtime validation of YAML configs
- Prefer async/await over promises chains
- Use structured logging (Pino) with log levels
- CLI output: `ora` spinners for long operations, `chalk` for color-coding (green=success, yellow=retry, red=failure)
- Final summary: table format with columns: Step | Status | Actions | Cost | Screenshot Path
- Error messages: clear, actionable, with suggestions for fixing flow instructions

## Provider Abstraction Layer

**Purpose**: Decouple mobile automation backend from core application logic, enabling easy switching between different automation tools (MCP servers, Appium, Maestro, etc.).

**Architecture**: Adapter pattern with `IMobileAutomationProvider` interface

### Key Components

1. **`IMobileAutomationProvider`** (interface): Defines all automation operations
   - Connection: `connect()`, `disconnect()`, `initializeDevice()`
   - UI Inspection: `getAccessibilityTree()`, `takeScreenshot()`, `getScreenInfo()`
   - Interaction: `tap()`, `tapCoordinates()`, `type()`, `scroll()`, `swipe()`, `pressButton()`
   - App Lifecycle: `launchApp()`, `terminateApp()`, `installApp()`, `uninstallApp()`

2. **`MobileMCPProvider`**: Adapter for `@mobilenext/mobile-mcp`
   - Uses MCP SDK for WebDriverAgent communication
   - Implements AppleScript-based clicking for React Native apps without accessibility props
   - Throws `UnsupportedOperationError` for operations not supported by mobile-mcp

3. **`ProviderFactory`**: Registry and factory for creating providers
   - Auto-detects provider type from endpoint string
   - Extensible registry for adding new providers

### Usage

**In application code**:
```typescript
// AINavigator and run.ts depend on the interface, not concrete implementations
async navigate(
  instruction: string,
  provider: IMobileAutomationProvider,  // ← Interface, not MCPClient
  costTracker: CostTracker,
  guardrails: Guardrails
): Promise<NavigationResult>
```

**Creating providers**:
```typescript
// Auto-detect from endpoint
const provider = ProviderFactory.create({
  type: 'mcp-server-mobile',
  endpoint: 'stdio://mcp-server-mobile'
});

await provider.connect('stdio://mcp-server-mobile');
await provider.initializeDevice(deviceUdid);
```

**Configuration**:
```yaml
mcp:
  endpoint: stdio://mcp-server-mobile  # Provider type auto-detected
```

### Adding New Providers

See `src/core/providers/README.md` for detailed instructions. Brief steps:

1. Create adapter class implementing `IMobileAutomationProvider`
2. Register in `PROVIDER_REGISTRY` in `provider-factory.ts`
3. Export from `index.ts`
4. Use via config `endpoint`

Available providers:
- **mobile-mcp** (`@mobilenext/mobile-mcp`): WebDriverAgent-based, best for React Native with accessibility labels
- **ios-simulator-mcp** (`ios-simulator-mcp`): iOS Debug Bridge (idb), native tapping, better for apps without accessibility props

Future providers that could be added:
- Different MCP servers (playwright-mcp, puppeteer-mcp)
- Appium WebDriver
- Maestro
- Custom automation backends

### Design Benefits

- **Swappable backends**: Change provider by updating config endpoint
- **Provider-specific capabilities**: Check what each provider supports via `getProviderInfo()`
- **Graceful degradation**: Unsupported operations throw `UnsupportedOperationError`
- **Testability**: Easy to create mock providers for testing
- **Future-proof**: Add new providers without modifying core application code

See `docs/PROVIDER_ABSTRACTION.md` for full implementation details and migration guide.

## Non-Goals

- Android support (iOS Simulator only)
- Visual diff / regression testing (marketing screenshots, not test automation)
- App Store Connect upload (we generate images, uploading is user's responsibility)
- Custom LLM providers (V2 targets OpenAI only)
- Real device support (Simulator only)
- Video recording (screenshots only)
