# Aperture — Product Requirements Document

**Version:** 2.0  
**Date:** 2026-02-13  
**Status:** Draft  

---

## 1. Introduction / Overview

Aperture is an AI-powered CLI tool that automates App Store screenshot generation for iOS apps. Instead of manually clicking through every screen in every language, developers describe their app flow in plain English using a YAML file. An AI agent then autonomously navigates the app in the iOS Simulator — tapping, typing, scrolling — to reach each screen, captures screenshots, composites them into store-ready assets with localized marketing copy, and exports them for every target locale.

The core innovation is replacing brittle record-and-replay automation with an LLM-driven agent that observes the screen's accessibility tree, plans actions, executes them via an MCP (Model Context Protocol) server controlling the Simulator, and verifies it reached the right screen. This means the agent adapts to any initial state — Expo debug menus, onboarding flows, layout differences between iPhone and iPad — without pre-recorded coordinates or element paths.

**One command. Every language. Store-ready.**

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| G-1 | Eliminate manual screenshot work | A 5-screen app in 10 locales goes from ~8 hours manual to < 15 min with Aperture |
| G-2 | AI-first navigation | ≥ 90% of navigate steps succeed without human intervention on well-structured apps |
| G-3 | Store-ready output | Exported images pass App Store Connect validation (correct dimensions, no artifacts) |
| G-4 | Cost efficiency | Full run (5 screens × 10 locales × 2 devices) costs < $2 in LLM API calls |
| G-5 | Developer experience | `aperture init` → `aperture run` workflow takes < 5 min to set up for a new project |
| G-6 | Self-hosted scalability | M3 web service handles ≥ 10 concurrent jobs on a Mac Mini M4 Pro |

---

## 3. User Stories

### Milestone 1 — Core AI Navigation + Screenshot Capture

#### US-1.01: Flow Definition

> As a developer, I want to describe my app's screenshot flow in a YAML file so that I don't need to record interactions.

- [ ] Parser accepts YAML with `app`, `steps[]` fields
- [ ] Supported step actions: `navigate`, `screenshot`, `type`, `wait`
- [ ] `navigate` steps require an `instruction` field (natural language)
- [ ] `screenshot` steps require a `label` field (used as filename)
- [ ] `type` steps accept `text` field (literal text to input)
- [ ] `wait` steps accept `duration` (seconds) or `condition` (natural language)
- [ ] Parser validates schema and reports clear errors with line numbers
- [ ] Variables `{{var_name}}` are recognized and left unresolved until execution

#### US-1.02: MCP Server Integration

> As a developer, I want Aperture to control the iOS Simulator programmatically so the AI agent can interact with my app.

- [ ] MCPClient connects to an MCP server (configurable endpoint)
- [ ] Supports `get_accessibility_tree()` → returns full UI hierarchy as structured data
- [ ] Supports `tap(element_id)` and `tap(x, y)` for coordinate-based taps
- [ ] Supports `type(text)` to input text into the focused field
- [ ] Supports `scroll(direction, amount)` where direction is up/down/left/right
- [ ] Supports `swipe(direction, startX, startY, endX, endY)`
- [ ] Supports `press_button(name)` for home, back, etc.
- [ ] Supports `take_screenshot()` → returns PNG buffer
- [ ] Supports `get_screen_info()` → dimensions, scale, orientation
- [ ] Supports app lifecycle: `install_app(path)`, `launch_app(bundleId)`, `terminate_app(bundleId)`, `uninstall_app(bundleId)`
- [ ] Connection errors are retried 3× with exponential backoff
- [ ] Timeout per MCP call: 10 seconds (configurable)

#### US-1.03: AI Navigator

> As a developer, I want an AI agent to interpret my natural language instructions and navigate my app autonomously.

- [ ] For each `navigate` step, the agent enters an observe → plan → act → verify loop
- [ ] **Observe:** Fetches accessibility tree from MCP server
- [ ] **Plan:** Sends tree + instruction to LLM, receives a single action (tap, type, scroll, swipe, press_button)
- [ ] **Act:** Executes the action via MCPClient
- [ ] **Verify:** Fetches new accessibility tree, asks LLM "Has the goal been reached?" (yes/no + reasoning)
- [ ] Loop continues until goal verified or max actions reached
- [ ] Default LLM: GPT-4o-mini. Escalates to GPT-4o after 5 failed attempts on a single step
- [ ] Each LLM call includes a system prompt with: available actions, current step instruction, action history for this step
- [ ] Agent maintains per-step action history to avoid repeating failed actions
- [ ] On final failure, logs full action history and accessibility tree for debugging

#### US-1.04: Screenshot Capture

> As a developer, I want screenshots taken at specific points in the flow so I can use them for App Store assets.

- [ ] When the flow reaches a `screenshot` step, captures via `take_screenshot()` MCP call
- [ ] Screenshot saved as `{output_dir}/{label}.png`
- [ ] Screenshots are full-resolution Simulator captures (no scaling)
- [ ] Status bar time is normalized (set to 9:41 via `xcrun simctl status_bar`)
- [ ] Battery, signal, and WiFi indicators set to full via status bar override

#### US-1.05: Device Management

> As a developer, I want Aperture to manage the Simulator lifecycle so I don't have to manually boot/install/launch.

- [ ] `DeviceManager.boot(udid)` boots a Simulator if not already booted
- [ ] `DeviceManager.install(udid, appPath)` installs `.app` bundle
- [ ] `DeviceManager.launch(udid, bundleId)` launches the app
- [ ] `DeviceManager.terminate(udid, bundleId)` terminates the app
- [ ] `DeviceManager.reset(udid)` erases all content and settings
- [ ] `DeviceManager.shutdown(udid)` shuts down the Simulator
- [ ] `DeviceManager.statusBar(udid)` sets time to 9:41, full battery/signal/wifi
- [ ] All operations use `xcrun simctl` under the hood
- [ ] Available simulators are discovered via `xcrun simctl list devices -j`

#### US-1.06: Setup Wizard

> As a developer, I want an interactive setup wizard so I can configure Aperture for my project quickly.

- [ ] `aperture init` launches an interactive CLI wizard
- [ ] Prompts for: app path (file picker / manual entry)
- [ ] Prompts for: target locales (multiselect from common list, default: en-US)
- [ ] Prompts for: iPhone simulator (select from available, default: latest iPhone Pro Max)
- [ ] Prompts for: iPad simulator (select from available, default: latest iPad Pro 13")
- [ ] Prompts for: template style (select from 5 built-in, default: minimal)
- [ ] Prompts for: output directory (default: `./aperture-output`)
- [ ] Prompts for: guardrails — max actions per step (default: 10), step timeout (default: 60s), run timeout (default: 600s), cost cap (default: $5.00)
- [ ] Each prompt shows current default; Enter accepts it
- [ ] `--yes` flag skips all prompts, uses defaults
- [ ] Generates `aperture.config.yaml` in project root
- [ ] Generates a starter `aperture-flow.yaml` with commented examples

#### US-1.07: Guardrails

> As a developer, I want safety limits so a misbehaving AI agent doesn't run forever or cost too much.

- [ ] Max actions per navigate step (default: 10). Exceeding → step fails, flow continues to next step
- [ ] Step timeout in seconds (default: 60). Exceeding → step fails
- [ ] Total run timeout in seconds (default: 600). Exceeding → run aborts
- [ ] Forbidden actions list (configurable). E.g., `["delete", "remove", "uninstall"]` — LLM actions containing these keywords are blocked
- [ ] LLM cost cap per run in USD (default: $5.00). Estimated from token counts × model pricing. Exceeding → run aborts
- [ ] Token usage tracked per LLM call and accumulated per run
- [ ] Cost summary printed at end of run

#### US-1.08: CLI Runner

> As a developer, I want a single command to execute my flow and get screenshots.

- [ ] `aperture run` reads `aperture.config.yaml` + `aperture-flow.yaml` from current directory
- [ ] `aperture run --flow path/to/flow.yaml` uses a specific flow file
- [ ] `aperture run --locale en-US` runs for a single locale only
- [ ] `aperture run --device iphone` runs on iPhone only
- [ ] Progress output shows: current step, action count, LLM model used, estimated cost so far
- [ ] On completion: summary table with step results (✓/✗), screenshot paths, total cost
- [ ] Exit code 0 if all screenshots captured, 1 if any step failed
- [ ] `--verbose` flag enables debug logging (full accessibility trees, LLM prompts/responses)

---

### Milestone 2 — Localization + Templates + Export

#### US-2.01: Locale Switching

> As a developer, I want Aperture to automatically switch the Simulator's locale so I get screenshots in every language.

- [ ] `LocaleManager.setLocale(udid, locale)` writes to `GlobalPreferences.plist` inside the Simulator's data directory
- [ ] Sets both `AppleLanguages` and `AppleLocale`
- [ ] Reboots the Simulator after locale change (required for iOS to pick up the change)
- [ ] Waits for Simulator to finish booting before continuing
- [ ] Supports all App Store Connect locales (37 locales)
- [ ] Locale codes follow Apple's format (e.g., `pt-BR`, `zh-Hans`)

#### US-2.02: Parameterized Flows

> As a developer, I want to use variables in my flow so the AI types locale-appropriate test data.

- [ ] Flow YAML supports `{{variable}}` syntax in `type` step text and `navigate` instructions
- [ ] Variable values loaded from locale data files: `locales/{locale}.yaml`
- [ ] Example: `locales/de.yaml` contains `user_name: "Müller"`, `group_name: "Familiengruppe"`
- [ ] Variables resolved before flow execution
- [ ] Missing variables → clear error listing which variables are undefined for which locale

#### US-2.03: AI-Generated Locale Test Data

> As a developer, I want the AI to generate culturally appropriate test data so my screenshots look authentic in every language.

- [ ] `aperture generate-data` command generates locale data files for all configured locales
- [ ] LLM generates culturally appropriate values: names, addresses, dates, currencies, sample content
- [ ] Developer provides a data schema in config (variable names + descriptions)
- [ ] Generated data saved to `locales/{locale}.yaml`
- [ ] Developer can edit generated files before running
- [ ] `--regenerate` flag overwrites existing locale data

#### US-2.04: Batch Execution

> As a developer, I want to run my flow across all locales and both device types in one command.

- [ ] `aperture run` (without `--locale`) iterates over all configured locales
- [ ] For each locale: switch locale → reboot → install app → run flow → capture screenshots
- [ ] After all iPhone locales complete, repeats for iPad
- [ ] If iPad flow fails for a locale, logs warning and continues (doesn't block other locales)
- [ ] Screenshots organized as `{output_dir}/{locale}/{device}/{label}.png`
- [ ] Total progress bar: `[12/70] de - iPad - group_chat`
- [ ] Resume support: `--resume` skips locales/devices where all screenshots already exist

#### US-2.05: Template Engine

> As a developer, I want my screenshots composited into store-ready marketing images with device frames and text.

- [ ] `TemplateEngine.composite(screenshot, options)` produces final store image
- [ ] 5 built-in styles:
  - **minimal** — white background, thin device frame, text below
  - **modern** — gradient background, floating device with shadow, text above
  - **gradient** — bold gradient background, angled device, large text overlay
  - **dark** — dark background, glowing edges on device, light text
  - **playful** — colorful background with shapes, rotated device, fun fonts
- [ ] Uses Sharp for image compositing (no native dependencies beyond Sharp)
- [ ] Device frames: iPhone 15 Pro Max, iPad Pro 13" (bundled as PNGs)
- [ ] Text overlay supports: title, subtitle per screenshot per locale
- [ ] Font: Inter (bundled), with fallback to system fonts for CJK/Arabic/etc.
- [ ] Custom templates via user-provided JSON layout definition (stretch goal)

#### US-2.06: Localized Marketing Copy

> As a developer, I want AI-generated marketing copy for each screenshot in every language.

- [ ] `TranslationService.generateCopy(screenshotLabel, locale, appDescription)` → title + subtitle
- [ ] Uses GPT-4o-mini to generate compelling, locale-appropriate marketing text
- [ ] Developer provides app description and screenshot context in config
- [ ] Copy saved to `locales/{locale}-copy.yaml`
- [ ] Developer can review/edit generated copy before final export
- [ ] `aperture generate-copy` command generates all copy files
- [ ] Respects App Store character limits for titles

#### US-2.07: App Store Export

> As a developer, I want final images exported in exact App Store dimensions so I can upload them directly.

- [ ] iPhone 6.5" export: 1242 × 2688 px (iPhone 15 Pro Max class)
- [ ] iPad 13" export: 2048 × 2732 px (iPad Pro 13")
- [ ] Output format: PNG (lossless) and JPEG (quality 90, for smaller upload)
- [ ] Export directory structure: `{output_dir}/export/{locale}/{device}/{label}.png`
- [ ] `aperture export` command runs template compositing on all captured screenshots
- [ ] Validates output dimensions match App Store requirements
- [ ] Generates a preview HTML page showing all screenshots in a grid

---

### Milestone 3 — Web Service

#### US-3.01: Web UI

> As a team, we want a browser-based interface to manage screenshot generation without using the CLI.

- [ ] Upload `.app` or `.ipa` file via browser
- [ ] Write/edit flow YAML in a code editor (Monaco)
- [ ] Configure locales, templates, guardrails via form UI
- [ ] Live Simulator view via WebSocket-streamed screenshots (1–2 fps)
- [ ] Start/stop/monitor job execution
- [ ] Download final export as ZIP
- [ ] Responsive layout (desktop only, min 1280px)

#### US-3.02: API Server

> As a developer, I want a REST API to trigger screenshot generation programmatically (CI/CD integration).

- [ ] `POST /api/jobs` — create a new job (upload app, flow YAML, config)
- [ ] `GET /api/jobs/:id` — get job status, progress, cost
- [ ] `GET /api/jobs/:id/screenshots` — list/download captured screenshots
- [ ] `DELETE /api/jobs/:id` — cancel a running job
- [ ] `GET /api/devices` — list available Simulator devices and their status
- [ ] Authentication via API key (header: `X-API-Key`)
- [ ] Rate limiting: 10 requests/sec per API key
- [ ] Request/response format: JSON, file uploads as multipart

#### US-3.03: Job Queue

> As an operator, I want jobs queued and processed in order so the server stays stable under load.

- [ ] BullMQ + Redis for job queue
- [ ] Job states: pending → running → completed / failed
- [ ] Priority queue: paid users get higher priority (future)
- [ ] Job timeout: configurable, default 30 minutes
- [ ] Failed jobs: retry once, then mark failed with error details
- [ ] Job cleanup: completed jobs and artifacts deleted after 24 hours (configurable)

#### US-3.04: Simulator Pool Manager

> As an operator, I want a pool of Simulators so multiple jobs can run concurrently.

- [ ] Pool size configurable (default: 4 iPhone + 4 iPad)
- [ ] Simulators pre-booted and kept warm
- [ ] Job acquires a Simulator pair (iPhone + iPad) from pool
- [ ] After job: Simulator reset (`simctl erase`) and returned to pool
- [ ] Health checks: ping Simulator every 30s, recreate if unresponsive
- [ ] Workspace isolation: each job gets a temp directory, cleaned up after completion

#### US-3.05: Session Management

> As an operator, I want proper session handling so jobs don't leak resources.

- [ ] Each job has a session with: job ID, allocated Simulators, temp workspace, start time
- [ ] Session timeout: if no progress for 5 minutes, job is killed
- [ ] Graceful shutdown: on SIGTERM, finish current step then clean up
- [ ] Orphan detection: on server start, kill any running Simulators not in pool

---

## 4. Functional Requirements

| ID | Requirement | Milestone | Priority |
|----|-------------|-----------|----------|
| FR-01 | Parse and validate YAML flow definitions | M1 | Must |
| FR-02 | Connect to and communicate with MCP server | M1 | Must |
| FR-03 | AI agent observe → plan → act → verify loop | M1 | Must |
| FR-04 | Capture screenshots at marked flow steps | M1 | Must |
| FR-05 | Manage Simulator lifecycle via `xcrun simctl` | M1 | Must |
| FR-06 | Interactive setup wizard (`aperture init`) | M1 | Must |
| FR-07 | Enforce guardrails (action limits, timeouts, cost cap) | M1 | Must |
| FR-08 | CLI runner with progress output | M1 | Must |
| FR-09 | Switch Simulator locale via plist manipulation | M2 | Must |
| FR-10 | Resolve parameterized variables from locale data | M2 | Must |
| FR-11 | Generate locale-specific test data via LLM | M2 | Should |
| FR-12 | Batch execution across locales and devices | M2 | Must |
| FR-13 | Template engine with 5 built-in styles | M2 | Must |
| FR-14 | Generate localized marketing copy via LLM | M2 | Should |
| FR-15 | Export images in App Store dimensions | M2 | Must |
| FR-16 | Web UI for job management | M3 | Must |
| FR-17 | REST API for programmatic access | M3 | Must |
| FR-18 | BullMQ job queue with Redis | M3 | Must |
| FR-19 | Simulator pool manager | M3 | Must |
| FR-20 | Session management and resource cleanup | M3 | Must |

---

## 5. Non-Goals

- **Android support.** iOS Simulator only. Android may come later but is explicitly out of scope.
- **Visual diff / regression testing.** Aperture captures screenshots for marketing, not for testing.
- **App Store Connect upload.** We generate the images; uploading them is the developer's responsibility (or a future integration).
- **Custom LLM providers.** V2 targets OpenAI models only. Pluggable providers may come later.
- **Real device support.** Simulator only. Real devices introduce USB/network complexity not worth tackling now.
- **Video recording.** Screenshots only.
- **Pixel-perfect replay.** The AI adapts to UI changes — this is a feature, not a limitation. Exact pixel reproduction across runs is not guaranteed.

---

## 6. Design Considerations

### Flow Definition UX

The YAML flow format is the primary user interface. It must be:
- **Readable** — A non-technical person should understand what the flow does
- **Minimal** — Common cases require few fields. Only `action` + `instruction`/`label` for most steps
- **Forgiving** — The AI compensates for vague instructions. "Go to settings" works even if the exact path varies

### CLI Output

- Use `ora` spinners for long-running operations
- Color-coded status: green (success), yellow (retry), red (failure)
- Cost tracking visible at all times during `--verbose` runs
- Final summary table with columns: Step | Status | Actions | Cost | Screenshot Path

### Error Recovery

When the AI navigator fails a step:
1. Log the failure with full context (accessibility tree, action history)
2. Continue to the next step (don't abort the entire run)
3. Mark the screenshot as missing in the final report
4. Suggest instruction improvements in the error output

### Template Customization (Future)

The 5 built-in styles cover common needs. For custom templates, a JSON layout definition will describe:
- Background (color, gradient, or image)
- Device position, scale, rotation
- Text regions (position, font, size, color, alignment)
- This is a stretch goal, not required for M2

---

## 7. Technical Considerations

### 7.1 Project Structure

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
│   │   ├── mcp-client.ts         # MCP server communication
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
│   ├── server/                   # M3
│   │   ├── app.ts                # Express server
│   │   ├── routes/
│   │   ├── queue/                # BullMQ workers
│   │   └── pool/                 # Simulator pool manager
│   └── types/
│       └── index.ts              # Shared type definitions
├── templates/
│   └── assets/                   # Device frame PNGs, fonts
├── docs/
│   └── prd.md
├── aperture.config.yaml          # Example config
├── aperture-flow.yaml            # Example flow
├── package.json
└── tsconfig.json
```

### 7.2 Pipeline Data Flow

#### Single-Locale Execution (M1)

```
┌─────────────────────────────────────────────────────────────────┐
│                        aperture run                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    FlowParser       │
                    │  Parse YAML → Flow  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   DeviceManager     │
                    │  Boot → Install →   │
                    │  Launch → StatusBar  │
                    └──────────┬──────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │     For each step in Flow      │
              │                                │
              │  navigate?  ──→  AINavigator   │
              │                  ┌──────────┐  │
              │                  │ Observe  │◄─┤─── MCP: get_accessibility_tree()
              │                  │ Plan     │◄─┤─── LLM: "what action?"
              │                  │ Act      │──┤──→ MCP: tap/type/scroll/...
              │                  │ Verify   │◄─┤─── LLM: "goal reached?"
              │                  └──────────┘  │
              │                  Loop until     │
              │                  done or limit  │
              │                                │
              │  screenshot? ──→ MCP: take_screenshot()
              │                  Save to disk   │
              │                                │
              │  type?       ──→ MCP: type(text)│
              │  wait?       ──→ sleep(duration)│
              └────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Summary Report    │
                    │  Steps ✓/✗, Cost,   │
                    │  Screenshot paths   │
                    └─────────────────────┘
```

#### Multi-Locale Batch Execution (M2)

```
┌─────────────────────────────────────────────────────────────┐
│                      aperture run                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  For each locale:      │
              │                        │
              │  LocaleManager         │
              │    .setLocale()        │──→ Write plist + reboot Simulator
              │                        │
              │  Resolve {{variables}} │──→ Load locales/{locale}.yaml
              │                        │
              │  Execute flow          │──→ (same as single-locale above)
              │                        │
              │  Save screenshots to   │
              │  {locale}/{device}/    │
              └────────────┬───────────┘
                           │
                           ▼  (repeat for iPad)
                           │
                           ▼
              ┌────────────────────────┐
              │  TemplateEngine        │
              │  For each screenshot:  │
              │    Load screenshot     │
              │    Load locale copy    │
              │    Composite with      │
              │    device frame + text │
              │    Export at App Store  │
              │    dimensions          │
              └────────────────────────┘
```

### 7.3 Module Contracts (TypeScript)

```typescript
// ── Flow Parser ──────────────────────────────────────────

interface FlowDefinition {
  app: string;
  steps: FlowStep[];
}

type FlowStep =
  | { action: 'navigate'; instruction: string }
  | { action: 'screenshot'; label: string }
  | { action: 'type'; text: string }
  | { action: 'wait'; duration?: number; condition?: string };

interface FlowParser {
  parse(yamlPath: string): Promise<FlowDefinition>;
  validate(flow: FlowDefinition): ValidationResult;
  resolveVariables(flow: FlowDefinition, variables: Record<string, string>): FlowDefinition;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
}

// ── MCP Client ───────────────────────────────────────────

interface AccessibilityNode {
  id: string;
  role: string;
  label?: string;
  value?: string;
  traits: string[];
  frame: { x: number; y: number; width: number; height: number };
  children: AccessibilityNode[];
}

interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  orientation: 'portrait' | 'landscape';
}

interface MCPClient {
  connect(endpoint: string): Promise<void>;
  disconnect(): Promise<void>;

  getAccessibilityTree(): Promise<AccessibilityNode>;
  tap(elementId: string): Promise<void>;
  tapCoordinates(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void>;
  swipe(startX: number, startY: number, endX: number, endY: number): Promise<void>;
  pressButton(button: 'home' | 'back'): Promise<void>;
  takeScreenshot(): Promise<Buffer>;
  getScreenInfo(): Promise<ScreenInfo>;

  installApp(appPath: string): Promise<void>;
  launchApp(bundleId: string): Promise<void>;
  terminateApp(bundleId: string): Promise<void>;
  uninstallApp(bundleId: string): Promise<void>;
}

// ── AI Navigator ─────────────────────────────────────────

interface NavigationResult {
  success: boolean;
  actionsExecuted: number;
  totalTokens: number;
  estimatedCost: number;
  actionHistory: ActionRecord[];
  error?: string;
}

interface ActionRecord {
  timestamp: number;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  success: boolean;
}

interface AINavigator {
  navigate(
    instruction: string,
    mcpClient: MCPClient,
    guardrails: Guardrails
  ): Promise<NavigationResult>;
}

interface Guardrails {
  maxActionsPerStep: number;
  stepTimeoutMs: number;
  runTimeoutMs: number;
  forbiddenActions: string[];
  costCapUsd: number;
}

// ── Device Manager ───────────────────────────────────────

interface SimulatorDevice {
  udid: string;
  name: string;
  runtime: string;
  state: 'Booted' | 'Shutdown';
  deviceType: 'iPhone' | 'iPad';
}

interface DeviceManager {
  listDevices(): Promise<SimulatorDevice[]>;
  boot(udid: string): Promise<void>;
  shutdown(udid: string): Promise<void>;
  install(udid: string, appPath: string): Promise<void>;
  launch(udid: string, bundleId: string): Promise<void>;
  terminate(udid: string, bundleId: string): Promise<void>;
  reset(udid: string): Promise<void>;
  setStatusBar(udid: string): Promise<void>;
}

// ── Locale Manager ───────────────────────────────────────

interface LocaleManager {
  setLocale(udid: string, locale: string): Promise<void>;
  getCurrentLocale(udid: string): Promise<string>;
  getSupportedLocales(): string[];
}

// ── Template Engine ──────────────────────────────────────

type TemplateStyle = 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful';

interface CompositeOptions {
  screenshot: Buffer;
  style: TemplateStyle;
  deviceType: 'iPhone' | 'iPad';
  title: string;
  subtitle?: string;
  locale: string;
}

interface TemplateEngine {
  composite(options: CompositeOptions): Promise<Buffer>;
  getAvailableStyles(): TemplateStyle[];
}

// ── Cost Tracker ─────────────────────────────────────────

interface CostTracker {
  record(model: string, promptTokens: number, completionTokens: number): void;
  getTotalCost(): number;
  getTotalTokens(): { prompt: number; completion: number };
  getSummary(): CostSummary;
  isOverBudget(capUsd: number): boolean;
}

interface CostSummary {
  totalCost: number;
  breakdown: Array<{ model: string; calls: number; tokens: number; cost: number }>;
}

// ── Translation Service ──────────────────────────────────

interface TranslationService {
  generateCopy(
    screenshotLabel: string,
    locale: string,
    appDescription: string,
    screenshotContext: string
  ): Promise<{ title: string; subtitle: string }>;
}

// ── Locale Data Generator ────────────────────────────────

interface DataSchema {
  variables: Array<{
    name: string;
    description: string;
    type: 'name' | 'text' | 'number' | 'date' | 'address' | 'custom';
  }>;
}

interface LocaleDataGenerator {
  generate(schema: DataSchema, locale: string): Promise<Record<string, string>>;
}
```

### 7.4 Data Models

#### `aperture.config.yaml`

```yaml
app: ./build/MyApp.app
bundleId: com.example.myapp
flow: ./aperture-flow.yaml

locales:
  - en-US
  - de
  - ja
  - pt-BR
  - ar

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
  endpoint: stdio://ios-simulator-mcp
```

#### `aperture-flow.yaml`

```yaml
app: ./build/MyApp.app
steps:
  - action: navigate
    instruction: "Dismiss any onboarding or debug dialogs and get to the main screen"

  - action: navigate
    instruction: "Open the main screen showing the list of groups"

  - action: screenshot
    label: group_list

  - action: navigate
    instruction: "Open the group called '{{group_name}}'"

  - action: screenshot
    label: group_chat

  - action: navigate
    instruction: "Open the settings screen"

  - action: type
    text: "{{user_name}}"

  - action: screenshot
    label: settings

  - action: navigate
    instruction: "Go back to the main screen and open the search feature"

  - action: screenshot
    label: search
```

#### `locales/de.yaml`

```yaml
user_name: "Müller"
group_name: "Familiengruppe"
search_query: "Nachrichten suchen"
```

### 7.5 Dependencies

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

### 7.6 Performance Targets

| Metric | Target |
|--------|--------|
| Single navigate step (avg) | < 15 seconds (3–5 LLM round trips) |
| Screenshot capture | < 2 seconds |
| Full flow (5 screenshots, 1 locale, 1 device) | < 3 minutes |
| Full batch (5 screenshots, 10 locales, 2 devices) | < 60 minutes |
| Template compositing per image | < 500ms |
| Locale switch + reboot | < 20 seconds |
| MCP server response (any call) | < 5 seconds |
| LLM API call (GPT-4o-mini) | < 3 seconds |

### 7.7 Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| MCP connection failure | Retry 3× with exponential backoff (1s, 2s, 4s). Then abort run. |
| MCP call timeout | Retry once. If still times out, fail the current step. |
| LLM API error (rate limit) | Retry with backoff up to 3× per call. |
| LLM API error (auth) | Abort immediately with clear error message. |
| Navigate step fails (max actions) | Log warning, mark step as failed, continue to next step. |
| Navigate step fails (timeout) | Same as above. |
| Cost cap exceeded | Abort run. Print cost summary and which steps completed. |
| Simulator crash | Attempt to reboot. If fails, abort run. |
| App crash during flow | Detect via MCP (empty accessibility tree or launch check). Relaunch app, retry step once. |
| Invalid flow YAML | Abort before execution with validation errors. |
| Missing locale data file | Abort with error listing missing variables and locales. |

### 7.8 Self-Hosted Multi-Tenant Architecture (M3)

```
                    ┌──────────────────────┐
                    │     Nginx / Caddy    │
                    │   (reverse proxy)    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Express Server     │
                    │   ├── REST API       │
                    │   ├── WebSocket      │
                    │   └── Static UI      │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
    │  BullMQ Worker │ │ BullMQ Worker│ │ BullMQ Worker│
    │  (Job Runner)  │ │ (Job Runner) │ │ (Job Runner) │
    └─────────┬──────┘ └──────┬───────┘ └──────┬───────┘
              │                │                 │
    ┌─────────▼────────────────▼─────────────────▼───────┐
    │              Simulator Pool Manager                  │
    │                                                      │
    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
    │  │ iPhone│ │ iPhone│ │ iPad │ │ iPad │  ...          │
    │  │ Sim 1│ │ Sim 2│ │ Sim 1│ │ Sim 2│               │
    │  └──────┘ └──────┘ └──────┘ └──────┘               │
    └─────────────────────────────────────────────────────┘
              │
    ┌─────────▼──────┐
    │     Redis      │
    │  (job queue +  │
    │   session state│
    │   + pub/sub)   │
    └────────────────┘
```

**Hardware target:** Mac Mini M4 Pro (24GB RAM, 14-core GPU)

- **Simulator capacity:** ~8 concurrent Simulators (4 iPhone + 4 iPad)
- **Concurrent jobs:** ~4 (each job uses 1 iPhone + 1 iPad Simulator)
- **Workspace isolation:** Each job gets `/tmp/aperture-job-{id}/` with its own app copy, flow, and output
- **Resource limits:** Each worker monitors memory/CPU. If Simulator memory exceeds 2GB, force-restart it.
- **Cleanup:** Job artifacts (screenshots, temp files) deleted 24h after completion. Configurable retention.
- **Monitoring:** Health endpoint (`GET /health`) reports: queue depth, active jobs, pool status, disk usage

---

## 8. Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Navigation success rate | ≥ 90% of steps succeed | Track per-step success/failure across all runs |
| Time to first screenshot set | < 15 min from `aperture init` | Measure onboarding time with test users |
| Cost per full run | < $2 for 5 screens × 10 locales × 2 devices | Track via CostTracker |
| App Store acceptance rate | 100% of exports pass dimension/format validation | Validate against App Store specs |
| CLI satisfaction | Developers report "easy" or "very easy" in feedback | Survey |
| M3 concurrent throughput | ≥ 10 jobs/hour on Mac Mini M4 Pro | Load testing |

---

## 9. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| OQ-1 | Which MCP server to use? Build custom or use existing `ios-simulator-mcp`? | M1 architecture | Open |
| OQ-2 | How reliable is the accessibility tree for complex apps (e.g., games, custom renderers)? | Navigation success rate | Needs testing |
| OQ-3 | Should we support screenshot-based vision (send actual screenshot image to LLM) as fallback when accessibility tree is insufficient? | Cost vs. reliability tradeoff | Open |
| OQ-4 | What's the optimal system prompt for the navigator LLM? Needs iteration. | Core quality | Open — will evolve during M1 |
| OQ-5 | How to handle apps that require authentication/login? Pre-configure credentials in flow? | Flow design | Open |
| OQ-6 | Should we support `.ipa` files or only `.app` bundles? `.ipa` requires extraction. | Developer UX | Leaning `.app` only for M1 |
| OQ-7 | How to handle device frame images? License-free frames or generate them? | Template engine | Open |
| OQ-8 | Should M3 support multiple Mac Minis in a cluster, or single-machine only? | Scalability | Single-machine for M3, cluster later |
| OQ-9 | What's the fallback if GPT-4o-mini can't navigate a step even after escalation to GPT-4o? | UX | Log + skip for now |
| OQ-10 | Should `aperture run` support a `--dry-run` mode that shows planned actions without executing? | Developer UX | Nice to have for M1 |
| OQ-11 | How to handle Simulator state between locales? Full erase vs. app-only reset? | Speed vs. reliability | Leaning app-only reset |
| OQ-12 | Pricing model for M3 web service? Per-job, subscription, or self-hosted only? | Business | Deferred |
