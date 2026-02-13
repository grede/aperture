# Aperture — MVP Product Requirements Document

**Version:** 2.0
**Date:** 2026-02-13
**Status:** Draft

---

## 1. Introduction / Overview

Aperture is an AI-powered tool that automates the creation of localized app store screenshots. Today, indie developers and small teams manually capture screenshots for every language × every screen × every device size — a combinatorial nightmare that scales as O(languages × screens × sizes).

Aperture solves this by letting users **record one walkthrough** on a local iOS Simulator, then **automatically replaying** it for every locale. The AI agent creates test data, navigates screens, captures screenshots, applies design templates with localized copy, and exports store-ready assets.

**Key differentiator:** No XCUITest code required. Unlike Fastlane snapshot (which demands XCUITest scripts), Aperture uses an accessibility-tree-first approach with AI fallback — users just click through their app once.

**MVP scope:** iOS only (Xcode Simulator), CLI for execution + web UI for recording.

---

## 2. Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Reduce screenshot creation time by 10× vs manual | User completes 5-language export in < 15 min (vs ~2.5h manual) |
| G2 | Achieve ≥ 95% playback success rate on recorded flows | Measured across 50 test runs on 10 different apps |
| G3 | Ship M1 within 4 weeks, M2 within 8 weeks, M3 within 12 weeks | Calendar milestones |
| G4 | Support 30+ languages for localization at launch | Translation pipeline covers all App Store languages |
| G5 | Deliver store-ready assets requiring zero manual post-processing | Exported PNGs pass App Store Connect asset validation |

---

## 3. User Stories

### Milestone 1 — Core Recording + Playback (CLI, iOS)

#### US-001: Connect to Local iOS Simulator
**Description:** As a developer, I want the CLI to detect and connect to a running local iOS Simulator so I can start recording.
**Acceptance Criteria:**
- [ ] CLI command `aperture devices` lists all booted iOS Simulators via `xcrun simctl list devices booted`
- [ ] CLI command `aperture connect <device-udid>` establishes a WebDriverAgent/XCUITest session on the target Simulator
- [ ] If no Simulator is booted, CLI prints actionable error with setup instructions (e.g., `xcrun simctl boot <udid>`)
- [ ] Connection timeout is configurable (default 30s)

#### US-002: Install Target App on Simulator
**Description:** As a developer, I want to specify my app's .app bundle so the tool installs it on the Simulator before recording.
**Acceptance Criteria:**
- [ ] CLI command `aperture init --app ./MyApp.app` installs the .app bundle via `xcrun simctl install`
- [ ] If app is already installed, user is prompted to reinstall or keep
- [ ] App bundle identifier is auto-detected and stored in project config (`aperture.config.json`)
- [ ] Invalid/missing .app path returns clear error
- [ ] IPA files are also accepted — system extracts the .app payload automatically

#### US-003: Record a Manual Walkthrough
**Description:** As a developer, I want to manually walk through my app while the tool records each step, so I can replay it later.
**Acceptance Criteria:**
- [ ] CLI command `aperture record` starts a recording session
- [ ] Each user action (tap, type, scroll, back) is captured with:
  - Action type and coordinates/element identifier
  - Accessibility tree snapshot (iOS accessibility hierarchy via XCUITest)
  - Timestamp relative to session start
- [ ] Recording is saved as a JSON file (`recordings/<name>.json`)
- [ ] User can name the recording session

#### US-004: Mark Screenshot Points During Recording
**Description:** As a developer, I want to mark specific moments during recording as "take screenshot here" so the tool knows which screens to capture.
**Acceptance Criteria:**
- [ ] Keyboard shortcut or CLI command during recording marks current screen as screenshot point
- [ ] Each screenshot point stores: name/label, accessibility tree, screen state hash
- [ ] At least 1 screenshot point required to save a valid recording
- [ ] Maximum 10 screenshot points per recording (MVP limit)

#### US-005: Replay a Recording Deterministically
**Description:** As a developer, I want to replay a saved recording on the same Simulator/locale so the tool reproduces my exact walkthrough.
**Acceptance Criteria:**
- [ ] CLI command `aperture play <recording-name>` replays all steps sequentially
- [ ] Elements are located primarily by: accessibilityIdentifier > accessibilityLabel > label text > XPath (priority order)
- [ ] Each step has a configurable timeout (default 10s) for element to appear
- [ ] If an element is not found, playback stops with error indicating which step failed
- [ ] Console output shows real-time progress: `Step 3/12: tap "Login button" ✓`

#### US-006: Capture Screenshots at Marked Points
**Description:** As a developer, I want the tool to capture PNG screenshots at each marked point during playback.
**Acceptance Criteria:**
- [ ] Screenshots are saved as PNG files in `output/<recording>/<locale>/screenshot-<n>.png`
- [ ] Screenshot resolution matches Simulator display (no scaling)
- [ ] Status bar is optionally hidden (configurable, default: hidden via `xcrun simctl status_bar override`)
- [ ] Each screenshot filename includes the user-defined label from recording

#### US-007: Reset App State Between Runs
**Description:** As a developer, I want the tool to clear app data before each playback run so recordings start from a clean state.
**Acceptance Criteria:**
- [ ] Before playback, app is uninstalled and reinstalled via `xcrun simctl uninstall` / `xcrun simctl install` (iOS has no direct "clear data" equivalent)
- [ ] App process is terminated via `xcrun simctl terminate` and relaunched via `xcrun simctl launch`
- [ ] User can opt out of data clearing via `--no-reset` flag
- [ ] Custom setup commands can be defined in config (e.g., pre-seed database via simctl keychain, push notification, etc.)

#### US-008: Interactive Setup Wizard + Project Configuration
**Description:** As a developer, I want an interactive setup wizard that guides me through project configuration step by step, with sensible defaults, so I can get started quickly without reading docs.
**Acceptance Criteria:**
- [ ] `aperture init` launches an interactive wizard (using `inquirer` or `prompts`) that collects config step-by-step:
  1. **App path** — prompt for .app/.ipa path, validate it exists, auto-detect bundle ID
  2. **Target locales** — multi-select from common locales (en, de, fr, es, ja, ko, zh, pt, ru, ...) with "Select all" option; default: `["en"]`
  3. **Simulator** — auto-detect available Simulators via `simctl list`, let user pick; default: latest iPhone
  4. **Template style** — pick from 5 built-in styles with preview descriptions; default: `modern`
  5. **Output directory** — default: `./output`
  6. **Safety guardrails** — max steps (default: 50), step timeout (default: 10s), run timeout (default: 5min)
  7. **Confirmation** — show summary of all choices, confirm or go back to edit
- [ ] Each step shows a sensible default that can be accepted with Enter
- [ ] `aperture init --yes` skips wizard and uses all defaults (non-interactive mode for CI)
- [ ] Result saved as `aperture.config.json` in current directory
- [ ] `locales` is a required field in config — wizard enforces at least one locale selected
- [ ] Config file is validated on load with clear error messages for invalid fields
- [ ] All CLI flags can override config file values
- [ ] `aperture config edit` re-launches the wizard with current values pre-filled for easy updates
- [ ] `aperture locales add <locale,...>` and `aperture locales remove <locale,...>` for quick locale management without re-running wizard

### Milestone 2 — AI Parameterization + Localization

#### US-009: AI-Parameterize a Recording
**Description:** As a developer, I want the AI to analyze my recording and identify text inputs that should change per locale (e.g., test data names, locale-specific strings).
**Acceptance Criteria:**
- [ ] CLI command `aperture parameterize <recording>` analyzes all steps
- [ ] AI identifies text input actions and suggests parameters: `{{user_name}}`, `{{group_name}}`, etc.
- [ ] User reviews and confirms/edits each suggestion interactively in CLI
- [ ] Parameterized recording is saved as a template (`templates/<name>.json`)
- [ ] Original recording is preserved unchanged

#### US-010: Define Locale-Specific Test Data
**Description:** As a developer, I want to provide locale-specific values for parameters (e.g., German names for `de` locale) so screenshots look authentic.
**Acceptance Criteria:**
- [ ] File `locales/<locale>.json` stores parameter values per locale
- [ ] CLI command `aperture locales generate` reads the list of target locales from `aperture.config.json` (configured during `aperture init` wizard, see US-008)
- [ ] GPT-4o-mini generates culturally appropriate test data for each parameter × each configured locale
- [ ] Generated data is saved as editable JSON — user can manually override any value
- [ ] LLM-generated values are cached; regeneration only on explicit request or `--force` flag
- [ ] Adding new locales via `aperture locales add` and re-running `generate` only generates data for newly added locales (existing data preserved)

#### US-011: Change Simulator Locale Programmatically
**Description:** As a developer, I want the tool to switch the iOS Simulator's locale automatically so my app renders in the target language.
**Acceptance Criteria:**
- [ ] Tool changes Simulator locale by writing to the Simulator's `/.GlobalPreferences.plist` via `plutil` / defaults commands and rebooting the Simulator (`xcrun simctl shutdown` + `xcrun simctl boot`)
- [ ] After locale change, tool waits for Simulator boot completion before proceeding
- [ ] App is relaunched after locale switch
- [ ] If locale is not supported by the Simulator, warning is logged and run is skipped

#### US-012: AI Fallback for Element Location
**Description:** As a developer, I want the AI to find UI elements when deterministic selectors fail, so playback doesn't break on minor UI changes.
**Acceptance Criteria:**
- [ ] When primary selector (accessibilityIdentifier/accessibilityLabel/label) fails, system captures current iOS accessibility tree
- [ ] Accessibility tree is sent to GPT-4o-mini with the original step context
- [ ] AI returns a candidate element identifier; system attempts to interact with it
- [ ] If AI fallback also fails, step is marked as failed with full diagnostic info
- [ ] AI fallback usage is logged and flagged in run report

#### US-013: Deterministic Verification After Each Step
**Description:** As a developer, I want each playback step verified deterministically (not via LLM) to ensure correctness.
**Acceptance Criteria:**
- [ ] After each action, system captures new accessibility tree
- [ ] Verification checks: expected screen/view controller is active, expected elements are present
- [ ] Verification uses string matching and tree comparison, never LLM
- [ ] Failed verification stops playback with detailed mismatch report
- [ ] Checkpoint assertions can be defined manually in template JSON

#### US-014: Batch Execution Across All Locales
**Description:** As a developer, I want to run one command that replays my recording across all configured locales.
**Acceptance Criteria:**
- [ ] CLI command `aperture run <template> --locales all` iterates through every configured locale
- [ ] Each locale run: switches locale → resets app → replays template → captures screenshots
- [ ] Progress displayed: `[3/15] Running locale: de_DE... ✓ (4 screenshots captured)`
- [ ] Failed locales are logged but don't block remaining locales
- [ ] Summary report at end: success/fail count per locale

#### US-015: Execution Safety Guardrails
**Description:** As a developer, I want configurable guardrails (max steps, timeouts, forbidden actions) to prevent runaway automation.
**Acceptance Criteria:**
- [ ] Config supports `maxSteps` (default: 50), `stepTimeout` (default: 10s), `runTimeout` (default: 5min)
- [ ] Config supports `forbiddenActions` list (e.g., "delete account", "sign out of iCloud")
- [ ] If any limit is hit, run is aborted with clear message
- [ ] All guardrail values are configurable per-project in `aperture.config.json`

#### US-016: Cache Successful Runs as Deterministic Scripts
**Description:** As a developer, I want successful AI-assisted runs to be cached so future runs use the exact same resolved selectors without calling the LLM.
**Acceptance Criteria:**
- [ ] After a successful run, resolved element selectors are saved per locale in `cache/<template>/<locale>.json`
- [ ] Subsequent runs use cached selectors first, falling back to AI only if cache misses
- [ ] CLI flag `--no-cache` forces fresh resolution
- [ ] Cache is invalidated when template is modified (detected via hash)

### Milestone 3 — Templates + Export + Web UI

#### US-017: Apply Device Frame Template to Screenshots
**Description:** As a developer, I want to apply a design template (device frame, background, text) to my raw screenshots so they look professional.
**Acceptance Criteria:**
- [ ] CLI command `aperture export <template> --style modern` applies the chosen template
- [ ] Template composites: background layer + device frame + screenshot + text overlay
- [ ] 5 built-in styles available: `minimal`, `modern`, `gradient`, `dark`, `playful`
- [ ] Text overlay uses localized copywriting from translations JSON
- [ ] Output is PNG at store-required resolutions

#### US-018: Generate Localized Copywriting for Templates
**Description:** As a developer, I want AI-generated marketing copy for each screenshot in every language.
**Acceptance Criteria:**
- [ ] CLI command `aperture translations generate` creates copy for each screenshot point × locale
- [ ] User provides base English copy per screenshot (e.g., "Chat with friends in real time")
- [ ] GPT-4o-mini translates and adapts copy for each locale (not literal translation — marketing tone)
- [ ] Translations saved in `translations/<locale>.json`, fully editable
- [ ] Regeneration only overwrites if `--force` flag is used

#### US-019: Export for App Store Sizes
**Description:** As a developer, I want exported screenshots in all required App Store Connect dimensions.
**Acceptance Criteria:**
- [ ] Exports iPhone 6.7" screenshots at 1290×2796 (iPhone 14 Pro Max / 15 Plus / 16 Plus)
- [ ] Exports iPhone 6.5" screenshots at 1242×2688 (iPhone 11 Pro Max / XS Max)
- [ ] Exports iPhone 5.5" screenshots at 1242×2208 (iPhone 8 Plus / legacy)
- [ ] Exports iPad Pro 12.9" (3rd gen+) at 2048×2732 (optional, configurable)
- [ ] Exports iPad Pro 12.9" (2nd gen) at 2048×2732 (optional, configurable)
- [ ] Exports iPad 10.5" at 1668×2224 (optional, configurable)
- [ ] Output directory structure: `export/<locale>/<device-type>/screenshot-<n>.png`
- [ ] All exports pass App Store Connect upload validation (PNG, RGB, no alpha, ≤ 8MB)

#### US-020: Web Recorder with Live Simulator Preview
**Description:** As a developer, I want a web UI that shows my Simulator screen live and lets me record walkthroughs by clicking in the browser.
**Acceptance Criteria:**
- [ ] `aperture web` starts a local web server on `localhost:3000`
- [ ] Web UI displays live Simulator screen via `xcrun simctl io booted screenshot` stream or native mirroring (< 200ms latency)
- [ ] Clicks/taps in browser are forwarded to Simulator via `xcrun simctl io booted input`
- [ ] Text input is supported via browser keyboard
- [ ] "Mark Screenshot" button adds a screenshot point (equivalent to CLI hotkey)
- [ ] Recording can be saved/named from the web UI
- [ ] Web UI shows accessibility tree panel alongside Simulator view

#### US-021: Web UI Template Preview
**Description:** As a developer, I want to preview how my screenshots will look with templates applied before exporting.
**Acceptance Criteria:**
- [ ] Web UI shows template preview gallery after a run completes
- [ ] User can switch between templates and locales in preview
- [ ] Preview renders at actual export resolution
- [ ] "Export All" button triggers full batch export

#### US-022: Import Existing Screenshots (No Recording)
**Description:** As a developer, I want to import existing screenshots and just apply templates + localization, even without recording.
**Acceptance Criteria:**
- [ ] CLI command `aperture import ./screenshots/` imports PNG files as screenshot points
- [ ] User maps each screenshot to a label and provides base English copy
- [ ] Template application and localized export work identically to recorded screenshots
- [ ] This mode skips all Simulator/playback functionality

---

## 4. Functional Requirements

### Recording & Playback

| ID | Requirement |
|----|-------------|
| FR-1 | System SHALL connect to iOS Simulators via `xcrun simctl` and establish XCUITest sessions through WebDriverAgent (or Appium XCUITest driver) |
| FR-2 | System SHALL record user actions as a structured JSON sequence including: action type, element selector (accessibilityIdentifier, accessibilityLabel, label, bounds), iOS accessibility hierarchy snapshot, and relative timestamp |
| FR-3 | System SHALL replay recorded actions using a priority-ordered selector strategy: accessibilityIdentifier → accessibilityLabel → label text → XPath |
| FR-4 | System SHALL capture full-resolution PNG screenshots at user-marked points during playback |
| FR-5 | System SHALL uninstall/reinstall the target app and relaunch before each playback run (unless `--no-reset`) |

### AI & Localization

| ID | Requirement |
|----|-------------|
| FR-6 | System SHALL analyze recordings and identify parameterizable text inputs using GPT-4o-mini |
| FR-7 | System SHALL generate culturally appropriate test data for each configured locale using GPT-4o-mini |
| FR-8 | System SHALL switch iOS Simulator locale via GlobalPreferences.plist manipulation and Simulator reboot, then wait for Simulator ready state before proceeding |
| FR-9 | System SHALL use AI fallback (iOS accessibility tree → GPT-4o-mini) when deterministic selectors fail to locate an element within the configured timeout |
| FR-10 | System SHALL verify each step deterministically using accessibility tree comparison and string matching — never via LLM |
| FR-11 | System SHALL enforce configurable guardrails: max_steps, step_timeout, run_timeout, forbidden_actions |
| FR-12 | System SHALL cache resolved selectors from successful AI-assisted runs and reuse them in subsequent runs |

### Templates & Export

| ID | Requirement |
|----|-------------|
| FR-13 | System SHALL composite screenshots with templates using Sharp: background + device frame + screenshot + text overlay |
| FR-14 | System SHALL ship 5 built-in template styles: minimal, modern, gradient, dark, playful |
| FR-15 | System SHALL generate localized marketing copy via GPT-4o-mini with caching and manual edit support |
| FR-16 | System SHALL export screenshots in App Store required dimensions: iPhone 6.7" (1290×2796), iPhone 6.5" (1242×2688), iPhone 5.5" (1242×2208), with optional iPad sizes (2048×2732, 1668×2224) |
| FR-17 | System SHALL organize exports as `export/<locale>/<device-type>/screenshot-<n>.png` |

### Web UI

| ID | Requirement |
|----|-------------|
| FR-18 | System SHALL serve a web UI on localhost that displays live iOS Simulator screen with < 200ms latency |
| FR-19 | System SHALL forward browser interactions (tap, type, scroll) to the connected Simulator |
| FR-20 | System SHALL display an iOS accessibility tree inspector panel in the web UI |

---

## 5. Non-Goals (Out of Scope for MVP)

- **Android support** — deferred to v2; architecture should accommodate it but no implementation in MVP
- **Cloud Simulators / emulators** — MVP is local-only; cloud execution is a post-MVP feature
- **CI/CD integration** — no GitHub Actions/pipeline support in MVP
- **Google Play export sizes** — iOS/App Store only in MVP
- **Custom template designer** — users choose from 5 presets; no drag-and-drop editor
- **Team collaboration features** — single-user only
- **Account system / authentication** — no user accounts in MVP
- **Video recording** — screenshots only, no animated previews or video walkthroughs
- **Physical device support** — Simulator only for MVP
- **Automatic app store upload** — export files only; no App Store Connect API integration

---

## 6. Design Considerations

### CLI Design
- Follow Unix conventions: composable commands, stdout for data, stderr for logs
- Use `ora` spinners for long operations, `chalk` for colored output
- Progress bars for batch operations (locale iteration)
- All output parseable with `--json` flag for scripting

### Web UI Design
- Split-panel layout: Simulator view (left), controls + accessibility tree (right)
- Recording controls as a floating toolbar over Simulator view
- Template preview as a gallery grid with locale switcher
- Minimal design — developer tool, not consumer app

### Template Design
- Templates defined as JSON schema: layers, positions, fonts, colors
- Device frames as SVG assets for resolution independence (iPhone 15, 14, SE, iPad Pro)
- Text overlay supports: title, subtitle, with configurable font/size/color/position
- Safe area constraints to prevent text overlapping device frame

---

## 7. Technical Considerations

### Architecture
```
CLI (Commander.js)
  ├── DeviceManager (xcrun simctl + WebDriverAgent)
  ├── Recorder (action capture + iOS accessibility tree)
  ├── Player (deterministic replay + AI fallback)
  ├── Parameterizer (GPT-4o-mini analysis)
  ├── LocaleManager (Simulator locale switching via plist)
  ├── TemplateEngine (Sharp compositing)
  ├── TranslationService (GPT-4o-mini + cache)
  └── WebServer (Express + WebSocket for UI)
```

### Project Structure

```
aperture/
├── package.json
├── tsconfig.json
├── aperture.config.json                # Default/example project config
├── src/
│   ├── index.ts                        # Main entry point, wires modules together
│   ├── types/
│   │   ├── index.ts                    # Re-exports all types
│   │   ├── recording.ts                # Recording, Step, ElementSelector, ScreenshotPoint
│   │   ├── template.ts                 # Template, Parameter
│   │   ├── locale.ts                   # LocaleData, LocaleConfig
│   │   ├── device.ts                   # SimulatorDevice, DeviceState, BootStatus
│   │   ├── player.ts                   # PlaybackResult, StepResult, StepStatus
│   │   ├── export.ts                   # ExportConfig, ExportResult, TemplateStyle
│   │   └── errors.ts                   # ApertureError, StepFailedError, DeviceError, AIFallbackError
│   ├── config/
│   │   ├── index.ts                    # Config loader: reads aperture.config.json, merges CLI flags
│   │   ├── schema.ts                   # Zod schema for config validation
│   │   └── defaults.ts                 # Default values for all config fields
│   ├── utils/
│   │   ├── logger.ts                   # Structured logger (pino) with context binding
│   │   ├── exec.ts                     # Wrapper around child_process.execFile for xcrun commands
│   │   ├── retry.ts                    # Generic retry helper with exponential backoff
│   │   ├── hash.ts                     # SHA-256 hashing for cache invalidation
│   │   └── ai-client.ts               # OpenAI client singleton, model selection, token tracking
│   ├── core/
│   │   ├── device-manager.ts           # SimulatorDevice lifecycle: list, boot, shutdown, install, locale
│   │   ├── recorder.ts                 # Action capture via WebDriverAgent event stream
│   │   ├── player.ts                   # Step-by-step replay engine with selector cascade + AI fallback
│   │   ├── parameterizer.ts            # GPT-4o-mini analysis of recordings → parameterized templates
│   │   └── locale-manager.ts           # Read/write GlobalPreferences.plist, reboot, wait-for-ready
│   ├── templates/
│   │   ├── template-engine.ts          # Sharp-based compositor: layers background + frame + screenshot + text
│   │   ├── styles/                     # Built-in template style definitions
│   │   │   ├── minimal.json
│   │   │   ├── modern.json
│   │   │   ├── gradient.json
│   │   │   ├── dark.json
│   │   │   └── playful.json
│   │   └── assets/                     # Static assets for templates
│   │       ├── frames/                 # Device frame SVGs (iphone-15.svg, iphone-14.svg, etc.)
│   │       ├── fonts/                  # Bundled fonts for text overlays
│   │       └── backgrounds/            # Gradient/pattern background PNGs
│   ├── translations/
│   │   └── translation-service.ts      # GPT-4o-mini translation with cache, manual override support
│   ├── web/
│   │   ├── server.ts                   # Express app setup, route registration, WebSocket init
│   │   ├── routes/
│   │   │   ├── api.ts                  # REST endpoints: /devices, /recordings, /templates, /export
│   │   │   └── ws.ts                   # WebSocket handlers: live Simulator stream, recording events
│   │   └── frontend/                   # Static frontend (Vite build output or plain HTML/JS)
│   │       ├── index.html
│   │       ├── recorder.js             # Simulator mirror + click capture + screenshot marking
│   │       └── preview.js              # Template preview gallery with locale switcher
│   ├── cli/
│   │   ├── index.ts                    # Commander.js program definition, registers all commands
│   │   ├── commands/
│   │   │   ├── init.ts                 # `aperture init` — create config, install app
│   │   │   ├── devices.ts              # `aperture devices` — list booted Simulators
│   │   │   ├── connect.ts              # `aperture connect` — establish WDA session
│   │   │   ├── record.ts              # `aperture record` — start recording session
│   │   │   ├── parameterize.ts         # `aperture parameterize` — AI analysis of recording
│   │   │   ├── play.ts                 # `aperture play` — replay a recording/template
│   │   │   ├── run.ts                  # `aperture run` — batch replay across all locales
│   │   │   ├── locales.ts              # `aperture locales generate` — generate locale test data
│   │   │   ├── translations.ts         # `aperture translations generate` — generate marketing copy
│   │   │   ├── export.ts               # `aperture export` — apply templates, output PNGs
│   │   │   ├── import.ts               # `aperture import` — import existing screenshots
│   │   │   └── web.ts                  # `aperture web` — start web UI server
│   │   └── ui.ts                       # CLI UI helpers: ora spinners, chalk formatting, prompts
│   └── queue/                          # Future: multi-tenant job queue (not implemented in M1)
│       ├── queue-manager.ts            # BullMQ queue setup, job definitions
│       ├── workers/
│       │   └── pipeline-worker.ts      # Worker that executes a full pipeline run
│       └── pool/
│           └── simulator-pool.ts       # Simulator checkout/checkin pool manager
├── tests/
│   ├── unit/                           # Unit tests per module
│   ├── integration/                    # Integration tests (require Simulator)
│   └── fixtures/                       # Test recordings, mock accessibility trees
├── dist/                               # Compiled output (gitignored)
└── docs/
    └── prd.md                          # This document
```

### Pipeline Data Flow

#### 1. Record Flow

```
CLI: `aperture record --name onboarding`
         │
         ▼
   DeviceManager.getConnectedDevice()
         │ returns SimulatorDevice { udid, wdaSessionUrl }
         ▼
   Recorder.startSession(device, recordingName)
         │
         ├── Subscribes to WDA event stream for tap/type/scroll actions
         ├── On each user action:
         │     ├── Captures action type + element selector from WDA response
         │     ├── Snapshots iOS accessibility tree via WDA /source endpoint
         │     └── Appends Step { index, action, selector, accessibilityTree, timestamp }
         ├── On "mark screenshot" hotkey/button:
         │     └── Appends ScreenshotPoint { afterStep, label, accessibilityTreeHash }
         │
         ▼
   Recorder.stopSession()
         │ validates ≥ 1 screenshot point
         ▼
   Writes: recordings/onboarding.json
         → Recording { id, name, bundleId, steps[], screenshotPoints[], createdAt }
```

#### 2. Parameterize Flow

```
CLI: `aperture parameterize onboarding`
         │
         ▼
   Reads: recordings/onboarding.json
         │
         ▼
   Parameterizer.analyze(recording)
         │
         ├── Filters steps where action === 'type'
         ├── Builds prompt with step context + typed values
         ├── Sends to GPT-4o-mini:
         │     "Given these typed values in an app walkthrough,
         │      identify which are locale-dependent test data.
         │      Return parameter name + description for each."
         ├── Receives: [ { stepIndex: 3, name: "user_name", description: "..." }, ... ]
         │
         ▼
   Parameterizer.confirmWithUser(suggestions)
         │ Interactive CLI: user accepts/edits/rejects each suggestion
         │
         ▼
   Writes: templates/onboarding.json
         → Template { ...recording, parameters[] }
   Original recording is NOT modified.
```

#### 3. Locale Generation Flow

```
CLI: `aperture locales generate --template onboarding`
         │
         ▼
   Reads: templates/onboarding.json → extracts Parameter[]
   Reads: aperture.config.json → extracts locales[] (e.g., ["de","fr","ja","ko","es"])
         │
         ▼
   TranslationService.generateLocaleData(parameters, locales)
         │
         ├── For each locale:
         │     ├── Builds prompt: "Generate culturally appropriate test data
         │     │    for locale {locale}. Parameters: {name, description, originalValue}..."
         │     ├── Sends to GPT-4o-mini
         │     ├── Receives: { user_name: "Müller", group_name: "Freunde", ... }
         │     └── Caches response (keyed by template hash + locale)
         │
         ▼
   Writes per locale: locales/de.json, locales/fr.json, ...
         → LocaleData { locale, parameters: Record<string,string>, translations: {} }
   (translations field populated separately by `aperture translations generate`)
```

#### 4. Replay Flow

```
CLI: `aperture run onboarding --locales all`
         │
         ▼
   Reads: templates/onboarding.json, locales/*.json, cache/<template>/*.json
         │
         ▼
   For each locale (sequential):
     │
     ├── LocaleManager.switchLocale(device, locale)
     │     ├── Writes locale + language to Simulator GlobalPreferences.plist
     │     ├── Shuts down Simulator: xcrun simctl shutdown <udid>
     │     ├── Boots Simulator: xcrun simctl boot <udid>
     │     └── Polls until Simulator reports "Booted" state (max 30s)
     │
     ├── DeviceManager.resetApp(device, bundleId, appPath)
     │     ├── xcrun simctl uninstall <udid> <bundleId>
     │     ├── xcrun simctl install <udid> <appPath>
     │     └── xcrun simctl launch <udid> <bundleId>
     │
     ├── Player.replay(template, localeData, cache?)
     │     │
     │     ├── For each Step:
     │     │     ├── Substitute parameter values from localeData
     │     │     ├── Try cached selector (if available)
     │     │     ├── Try selector cascade: accessibilityIdentifier → accessibilityLabel → label → xpath
     │     │     ├── If all fail → AI fallback:
     │     │     │     ├── Capture current accessibility tree via WDA /source
     │     │     │     ├── Send to GPT-4o-mini: "Find element matching: {original selector context}"
     │     │     │     ├── If GPT-4o-mini fails → escalate to GPT-4o
     │     │     │     └── If GPT-4o fails → StepFailedError
     │     │     ├── Execute action on resolved element via WDA
     │     │     ├── Verify post-action state deterministically (accessibility tree diff)
     │     │     └── Update cache with resolved selector
     │     │
     │     ├── At each ScreenshotPoint:
     │     │     ├── xcrun simctl status_bar override (hide status bar)
     │     │     ├── xcrun simctl io booted screenshot → PNG buffer
     │     │     └── Save to output/<template>/<locale>/screenshot-<label>.png
     │     │
     │     └── Returns PlaybackResult { locale, steps: StepResult[], screenshots: string[] }
     │
     └── Write updated cache: cache/<template>/<locale>.json
         │
         ▼
   Summary report: success/fail per locale, AI fallback count, total time
```

#### 5. Export Flow

```
CLI: `aperture export onboarding --style modern`
         │
         ▼
   Reads: output/<template>/<locale>/screenshot-*.png     (raw screenshots)
   Reads: templates/styles/modern.json                     (template style definition)
   Reads: translations/<locale>.json                       (localized marketing copy)
   Reads: templates/assets/frames/<device>.svg             (device frames)
         │
         ▼
   TemplateEngine.export(screenshots, style, translations, targetSizes)
         │
         ├── For each locale × each screenshot × each target size:
         │     ├── Create background layer (gradient/solid/pattern per style)
         │     ├── Resize screenshot to fit within device frame bounds
         │     ├── Composite device frame SVG → PNG overlay
         │     ├── Render text overlay:
         │     │     ├── Title from translations[locale][screenshotLabel]
         │     │     ├── Font, size, color, position from style definition
         │     │     └── Handle long text: auto-shrink font to fit safe area
         │     ├── Composite all layers via Sharp: background + frame + screenshot + text
         │     ├── Resize final image to target dimensions (e.g., 1290×2796)
         │     └── Output as PNG (RGB, no alpha, ≤ 8MB)
         │
         ▼
   Writes: export/<locale>/<device-type>/screenshot-<label>.png
   Example: export/de/iphone-6.7/screenshot-chat.png
```

### Module Contracts

#### DeviceManager

- **Inputs:** Simulator UDID (optional), app bundle path, bundle identifier
- **Outputs:** `SimulatorDevice` object with UDID, WDA session URL, device state
- **Dependencies:** `xcrun simctl` (system), WebDriverAgent (running on Simulator)
- **Key methods:**
  ```typescript
  listDevices(): Promise<SimulatorDevice[]>
  // Lists all booted Simulators via `xcrun simctl list devices booted -j`

  connect(udid: string): Promise<SimulatorDevice>
  // Starts/connects to WDA session on target Simulator, returns device handle

  installApp(device: SimulatorDevice, appPath: string): Promise<string>
  // Installs .app/.ipa on Simulator, returns resolved bundleId

  resetApp(device: SimulatorDevice, bundleId: string, appPath: string): Promise<void>
  // Uninstalls, reinstalls, and launches app (clean state)
  ```

#### Recorder

- **Inputs:** Connected `SimulatorDevice`, recording name
- **Outputs:** `Recording` JSON written to `recordings/<name>.json`
- **Dependencies:** DeviceManager (for device handle), WebDriverAgent (for event stream + accessibility tree)
- **Key methods:**
  ```typescript
  startSession(device: SimulatorDevice, name: string): Promise<RecordingSession>
  // Begins capturing actions from WDA event stream; returns session handle

  markScreenshot(session: RecordingSession, label: string): void
  // Marks current state as a screenshot capture point

  stopSession(session: RecordingSession): Promise<Recording>
  // Validates ≥ 1 screenshot point, writes JSON, returns Recording object
  ```

#### Player

- **Inputs:** `Template` (or `Recording`), `LocaleData` (optional), cached selectors (optional)
- **Outputs:** `PlaybackResult` with per-step status, captured screenshot paths, updated cache
- **Dependencies:** DeviceManager (WDA commands), `utils/ai-client` (for AI fallback), `utils/retry`
- **Key methods:**
  ```typescript
  replay(template: Template, localeData?: LocaleData, cache?: SelectorCache): Promise<PlaybackResult>
  // Replays all steps with selector cascade + AI fallback; captures screenshots at marked points

  replayStep(step: Step, device: SimulatorDevice, retries: number): Promise<StepResult>
  // Executes a single step: resolve selector → perform action → verify → return result

  resolveElement(step: Step, device: SimulatorDevice): Promise<ResolvedSelector>
  // Selector cascade: cached → accessibilityIdentifier → accessibilityLabel → label → xpath → AI fallback
  ```

#### Parameterizer

- **Inputs:** `Recording` with typed text steps
- **Outputs:** `Template` (recording + parameter definitions)
- **Dependencies:** `utils/ai-client` (GPT-4o-mini)
- **Key methods:**
  ```typescript
  analyze(recording: Recording): Promise<ParameterSuggestion[]>
  // Sends text-input steps to GPT-4o-mini, returns suggested parameters

  confirmWithUser(suggestions: ParameterSuggestion[]): Promise<Parameter[]>
  // Interactive CLI prompt: user accepts/edits/rejects each suggestion

  createTemplate(recording: Recording, parameters: Parameter[]): Template
  // Merges confirmed parameters into recording to produce Template
  ```

#### LocaleManager

- **Inputs:** `SimulatorDevice`, target locale string (e.g., `"de_DE"`)
- **Outputs:** Simulator rebooted in new locale, ready for app launch
- **Dependencies:** DeviceManager (for shutdown/boot), `xcrun simctl`, `plutil`
- **Key methods:**
  ```typescript
  switchLocale(device: SimulatorDevice, locale: string): Promise<void>
  // Writes locale to GlobalPreferences.plist, reboots Simulator, waits until ready

  getCurrentLocale(device: SimulatorDevice): Promise<string>
  // Reads current locale from Simulator plist

  validateLocale(locale: string): boolean
  // Checks if locale string is valid iOS locale identifier
  ```

#### TemplateEngine

- **Inputs:** Raw screenshot PNGs, template style definition, translations, target export sizes
- **Outputs:** Composited store-ready PNG files
- **Dependencies:** `sharp` (image processing), template style JSONs, asset files (frames, fonts, backgrounds)
- **Key methods:**
  ```typescript
  composite(screenshotPath: string, style: TemplateStyle, text: string, targetSize: ExportSize): Promise<Buffer>
  // Composites one screenshot with template layers, returns PNG buffer

  exportAll(config: ExportConfig): Promise<ExportResult>
  // Batch export: all locales × all screenshots × all target sizes → writes to export/ directory

  listStyles(): TemplateStyle[]
  // Returns available built-in template styles
  ```

#### TranslationService

- **Inputs:** Source text (English marketing copy), target locales, parameters with descriptions
- **Outputs:** Translated text per locale, locale-specific test data
- **Dependencies:** `utils/ai-client` (GPT-4o-mini), file system for cache
- **Key methods:**
  ```typescript
  generateLocaleData(parameters: Parameter[], locales: string[]): Promise<Map<string, LocaleData>>
  // Generates culturally appropriate test data for each locale via GPT-4o-mini

  translateCopy(baseCopy: Record<string, string>, locales: string[]): Promise<Map<string, Record<string, string>>>
  // Translates marketing copy for all screenshot labels × all locales

  getCached(templateHash: string, locale: string): LocaleData | null
  // Returns cached locale data if template hasn't changed; null forces regeneration
  ```

### Self-Hosted Multi-Tenant Architecture (Future: post-M1)

> **This section describes the planned post-MVP architecture. M1 does not implement any of this, but the M1 module boundaries and data flow are designed to not block this evolution.**

```
                          ┌─────────────────┐
  Client A (API key) ───▶ │                 │
  Client B (API key) ───▶ │  API Server     │──▶ BullMQ Job Queue ──▶ Redis
  Client C (API key) ───▶ │  (Fastify)      │
                          └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Pipeline Worker │ (×3-4 concurrent)
                                              │                 │
                                              │  1. Checkout Simulator from pool
                                              │  2. Create isolated workspace
                                              │  3. Run pipeline (same code as CLI)
                                              │  4. Upload results to storage
                                              │  5. Return Simulator to pool
                                              │  6. Fire webhook / update status
                                              └─────────────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │ Simulator Pool   │
                                              │ (pre-booted ×4)  │
                                              │ checkout/checkin  │
                                              └─────────────────┘
```

**Components:**

- **API Server (Fastify):** REST API wrapping the CLI pipeline. Endpoints: `POST /jobs` (submit pipeline run), `GET /jobs/:id` (poll status), `GET /jobs/:id/results` (download exports). Validates API key from `Authorization` header against a simple key→client mapping in config/Redis.

- **Job Queue (BullMQ + Redis):** Each API request creates a BullMQ job with: client ID, template config, locales, app bundle reference. Jobs are prioritized FIFO per client. Redis stores job state, progress, and results metadata.

- **Simulator Pool Manager (`src/queue/pool/simulator-pool.ts`):** Pre-boots N Simulators at server startup (N = 3–4 for M4 Pro with 12+ cores and 24+ GB RAM). Each Simulator has a unique UDID and is tracked as `idle` | `in-use`. Workers call `pool.checkout()` to get an idle Simulator and `pool.checkin(udid)` to return it. If all Simulators are busy, the job waits in queue. Health check pings each idle Simulator periodically; unresponsive ones are rebooted.

- **Workspace Isolation:** Each job gets a temporary working directory (`/tmp/aperture-jobs/<jobId>/`) containing its own `recordings/`, `templates/`, `locales/`, `output/`, `export/` directories. The pipeline modules already operate on paths from config — the job worker just overrides the base path. Cleanup happens after result upload (or after configurable TTL).

- **Concurrency Model:** 3–4 parallel pipeline workers on M4 Pro. Each worker holds one Simulator. Locale switches within a job are sequential (Simulator reboot required). Multiple jobs run truly in parallel on separate Simulators.

- **Authentication:** Simple API key scheme. Config file maps API keys to client IDs. Rate limiting per client (e.g., 10 jobs/hour). No user accounts, no OAuth — just static keys for trusted clients.

- **Job Status & Webhooks:** Clients poll `GET /jobs/:id` for status (`queued` → `running` → `completed` | `failed`). Optionally, clients provide a `webhookUrl` at job submission — server POSTs status updates to it. Job results (exported PNGs) are served via signed temporary URLs or direct download.

**Why this doesn't block M1:** The M1 CLI modules (`Player`, `DeviceManager`, `TemplateEngine`, etc.) take explicit config/paths as inputs — they don't assume global state or singleton Simulators. The `src/queue/` directory exists in the project structure but remains empty stubs until post-M1 implementation.

### Error Handling Strategy

**Structured Error Types:**

```typescript
// Base error — all Aperture errors extend this
class ApertureError extends Error {
  code: string;          // Machine-readable: "DEVICE_NOT_FOUND", "STEP_FAILED", etc.
  context: object;       // Structured metadata for debugging
}

class DeviceError extends ApertureError {
  // code: "DEVICE_NOT_FOUND" | "DEVICE_BOOT_TIMEOUT" | "WDA_CONNECTION_FAILED"
  // context: { udid, timeout, lastState }
}

class StepFailedError extends ApertureError {
  // code: "SELECTOR_NOT_FOUND" | "AI_FALLBACK_FAILED" | "STEP_TIMEOUT" | "VERIFICATION_FAILED"
  // context: { stepIndex, action, selectorAttempted, accessibilityTree, aiResponse? }
}

class AIFallbackError extends ApertureError {
  // code: "AI_MINI_FAILED" | "AI_FULL_FAILED" | "AI_RATE_LIMITED"
  // context: { model, prompt, response, tokensUsed }
}

class LocaleError extends ApertureError {
  // code: "LOCALE_SWITCH_FAILED" | "LOCALE_UNSUPPORTED" | "PLIST_WRITE_FAILED"
  // context: { locale, device, plistPath }
}

class ExportError extends ApertureError {
  // code: "TEMPLATE_RENDER_FAILED" | "ASSET_NOT_FOUND" | "IMAGE_TOO_LARGE"
  // context: { style, screenshotPath, targetSize }
}
```

**Per-Step Retry Logic (Player):**

1. **Selector cascade** (no retry needed — sequential fallback): cached → accessibilityIdentifier → accessibilityLabel → label → xpath
2. **If entire cascade fails**, retry the step up to `config.stepRetries` times (default: 2) with a 1-second delay — UI may still be animating
3. **If retries exhausted**, escalate to AI fallback:
   - First attempt: GPT-4o-mini (fast, cheap)
   - If GPT-4o-mini returns no match or wrong element: GPT-4o (more capable)
   - If GPT-4o fails: `StepFailedError` with full diagnostic context
4. **Step timeout**: each step has `config.stepTimeout` (default 10s). If element not found within timeout, skip directly to AI fallback

**Run-Level Isolation:**

- Each locale runs independently. A failed locale logs the error and continues to the next locale
- Failed locales are reported in the summary but do not block successful ones
- The run exits with code 0 if ≥ 1 locale succeeds, code 1 if all fail

**Logging:**

- All errors logged via structured logger (pino) with:
  - `stepIndex`: which step failed
  - `action`: what was being attempted
  - `selectorAttempted`: the selector chain that was tried
  - `accessibilityTree`: full tree at time of failure (truncated to relevant subtree)
  - `aiResponse`: if AI fallback was used, the model's response
  - `duration`: how long the step took before failing
- Log levels: `debug` (every selector attempt), `info` (step success), `warn` (AI fallback used), `error` (step/run failed)
- Logs written to both stderr (for CLI) and `logs/<run-id>.json` (structured, for programmatic analysis)

### Key Technical Decisions
- **WebDriverAgent / Appium XCUITest driver over raw XCTest**: Better programmatic control, mature Node.js client via WebDriverIO, full access to iOS accessibility hierarchy. Facebook's WebDriverAgent provides the bridge between HTTP commands and XCUITest framework.
- **`xcrun simctl` as the device management layer**: Native Apple tooling for Simulator lifecycle (boot, shutdown, install, uninstall, locale changes, status bar overrides, screenshots). No third-party dependency needed for device management.
- **Accessibility tree over screenshots for AI**: Structured hierarchy data is cheaper, faster, and more reliable than vision models analyzing pixel data.
- **Sharp over Canvas/Puppeteer for templates**: Native Node.js image processing, no browser dependency, fast batch processing.
- **GPT-4o-mini as default, GPT-4o as fallback**: Cost optimization — mini handles 95%+ of cases at ~10× lower cost.

### Performance Targets
- Recording startup: < 5s from command to ready
- Playback step execution: < 2s average per step
- Locale switch: < 20s including Simulator reboot
- Template rendering: < 1s per screenshot
- Full 5-language, 5-screenshot export: < 10 minutes

### Data Model
```typescript
// Recording
interface Recording {
  id: string;
  name: string;
  bundleId: string;
  steps: Step[];
  screenshotPoints: ScreenshotPoint[];
  createdAt: string;
}

interface Step {
  index: number;
  action: 'tap' | 'type' | 'scroll' | 'back' | 'home';
  selector: ElementSelector;
  value?: string; // for type actions
  accessibilityTree: string; // iOS accessibility hierarchy snapshot
  timestamp: number;
}

interface ElementSelector {
  accessibilityIdentifier?: string;
  accessibilityLabel?: string;
  label?: string;
  xpath?: string;
  bounds?: [number, number, number, number];
}

interface ScreenshotPoint {
  afterStep: number;
  label: string;
  accessibilityTreeHash: string;
}

// Parameterized Template
interface Template extends Recording {
  parameters: Parameter[];
}

interface Parameter {
  name: string; // e.g., "user_name"
  stepIndex: number;
  originalValue: string;
  description: string;
}

// Locale Data
interface LocaleData {
  locale: string;
  parameters: Record<string, string>;
  translations: Record<string, string>; // screenshot label → marketing copy
}
```

### Dependencies
- `appium` + `webdriverio` (XCUITest driver) — Simulator control via WebDriverAgent
- `sharp` — image compositing
- `openai` — GPT API access
- `commander` — CLI framework
- `express` + `ws` — web server
- `xcrun simctl` (system) — Simulator lifecycle management, screen capture, input injection

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Playback success rate | ≥ 95% | Automated test suite: 10 apps × 5 locales |
| Time to first export | < 30 min | From `aperture init` to first localized screenshot set |
| Time per additional locale | < 3 min | After initial recording is done |
| AI fallback rate | < 10% of steps | Logged per run; high rates indicate selector quality issues |
| LLM cost per full run | < $0.10 | For 5 locales × 5 screenshots including translations |
| Template render time | < 1s per image | Benchmarked on M1/M2 Mac |
| User satisfaction (beta) | ≥ 4/5 | Post-beta survey, n ≥ 20 |

---

## 9. Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ-1 | WebDriverAgent vs Appium XCUITest driver — should we use Facebook's WDA directly or go through Appium's abstraction layer? | M1 architecture | Engineering |
| OQ-2 | How to handle apps that require Apple Sign-In or other iOS-specific authentication flows during recording? | Recording completeness | Engineering |
| OQ-3 | Should we support landscape screenshots for iPad/game apps in MVP? | FR-16 scope | Product |
| OQ-4 | What's the minimum iOS version we support? (Affects accessibility API capabilities and Simulator availability) | Compatibility | Engineering |
| OQ-5 | What's the minimum Xcode version required? (Determines simctl feature availability and WebDriverAgent compatibility) | Compatibility | Engineering |
| OQ-6 | How do we handle dynamic content (timestamps, relative dates, random avatars) in screenshot verification? | Verification reliability | Engineering |
| OQ-7 | Should we support right-to-left (RTL) languages in M2 or defer? | Localization scope | Product |
| OQ-8 | License model for device frame assets — create our own or use existing open-source frames? | Legal / Design | Design |
| OQ-9 | Do we need analytics/telemetry in CLI for usage insights, and if so, how to handle privacy? | Growth | Product |
| OQ-10 | How to handle apps that use SwiftUI previews vs UIKit — does the accessibility tree differ significantly? | Selector reliability | Engineering |
| OQ-11 | Self-hosted multi-tenancy: how to isolate working directories and Simulator instances between concurrent client runs on a single Mac Mini? | Scalability / M2+ | Engineering |
| OQ-12 | Task queue architecture (BullMQ/Redis vs simpler alternative) for scheduling and prioritizing concurrent pipeline runs? | Scalability / M2+ | Engineering |
| OQ-13 | Simulator pool management: pre-boot a pool of Simulators vs boot-on-demand? What's the optimal pool size for M4 Pro (12-14 cores, 24-48GB RAM)? | Performance / Scalability | Engineering |
