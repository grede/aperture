# Milestone 1 Implementation Status

## ✅ Completed User Stories

### US-001: Connect to Local iOS Simulator ✅
**Implementation:** `src/core/device-manager.ts`

Fully functional device management:
- List all iOS Simulators via `xcrun simctl`
- Filter by boot status
- Get device details (name, version, state, type)
- Boot/shutdown Simulators with status polling
- Wait for boot completion with timeout

**CLI Commands:**
```bash
aperture devices              # List all Simulators
aperture devices --booted     # List only booted ones
aperture devices --json       # JSON output
```

---

### US-002: Install Target App on Simulator ✅
**Implementation:** `src/core/device-manager.ts`

Complete app lifecycle management:
- Install .app bundles
- Extract and install .ipa files
- Auto-detect bundle ID from Info.plist
- Uninstall apps
- Launch/terminate apps
- Reset app state (uninstall → install → launch)

**Features:**
- Handles both .app and .ipa formats
- Automatic IPA extraction to /tmp
- Bundle ID validation
- Process management

---

### US-003: Record a Manual Walkthrough ✅
**Implementation:**
- `src/core/wda-connection.ts` - WebDriverAgent wrapper
- `src/core/recorder.ts` - Recording engine

Full recording capabilities:
- Connect to Appium/WebDriverAgent
- Capture user actions (tap, type, swipe, scroll, back, home)
- Record element selectors (accessibility ID, label, XPath, bounds)
- Snapshot iOS accessibility tree at each step
- Save recordings as JSON with metadata

**CLI Command:**
```bash
aperture record                    # Interactive recording
aperture record --name onboarding  # With name
aperture record --device <UDID>    # Specific device
```

**Recording Format:**
```json
{
  "id": "rec-timestamp-random",
  "name": "onboarding",
  "bundleId": "com.example.app",
  "steps": [
    {
      "index": 0,
      "action": "tap",
      "selector": { "accessibilityIdentifier": "login_button" },
      "accessibilityTree": "<xml>...</xml>",
      "timestamp": 1234
    }
  ],
  "screenshotPoints": [...],
  "createdAt": "2026-02-13T..."
}
```

---

### US-004: Mark Screenshot Points During Recording ✅
**Implementation:** `src/core/recorder.ts`

Screenshot marker system:
- Interactive CLI for marking points
- Label-based identification
- Accessibility tree hash for verification
- Link to step index
- Optional description field

**Usage:**
```bash
# During recording session:
> screenshot login-screen
> screenshot chat-interface
> done
```

**Data Structure:**
```json
{
  "afterStep": 5,
  "label": "login-screen",
  "accessibilityTreeHash": "sha256-hash",
  "description": "User login interface"
}
```

---

### US-005: Replay a Recording Deterministically ✅
**Implementation:** `src/core/player.ts`

Robust playback engine:
- **Selector Cascade** (priority order):
  1. Cached selector (from previous AI resolution)
  2. accessibilityIdentifier (most stable)
  3. accessibilityLabel
  4. label text
  5. XPath (last resort)
  6. AI fallback (placeholder for future)

- **Retry Logic:**
  - Configurable retries per step (default: 2)
  - Linear backoff for UI elements
  - Timeout handling (default: 10s per step)

- **Action Execution:**
  - Tap (coordinates or element-based)
  - Type (into focused element)
  - Swipe/scroll gestures
  - Home/back navigation
  - Wait actions

**CLI Command:**
```bash
aperture play onboarding                    # Replay recording
aperture play onboarding --locale de        # With locale
aperture play onboarding --device <UDID>    # Specific device
```

**Playback Result:**
```json
{
  "recordingId": "rec-123",
  "steps": [
    {
      "stepIndex": 0,
      "status": "success",
      "duration": 1234,
      "selectorUsed": "~login_button",
      "usedAIFallback": false
    }
  ],
  "screenshots": ["path/to/screenshot1.png"],
  "successCount": 10,
  "failureCount": 0,
  "duration": 15234
}
```

---

### US-006: Capture Screenshots at Marked Points ✅
**Implementation:** `src/core/screenshot.ts`

Professional screenshot capture:
- Uses `xcrun simctl io booted screenshot`
- Status bar override (clean 9:41, 100% battery, full signal)
- Configurable delay before capture
- Automatic directory creation
- PNG format with proper naming

**Features:**
- Hide/show status bar
- Batch capture support
- Sequential captures with intervals
- Dimension detection (placeholder)

**Output Structure:**
```
output/
└── recording-name/
    ├── en/
    │   ├── login-screen.png
    │   ├── chat-interface.png
    │   └── settings.png
    └── de/
        ├── login-screen.png
        └── ...
```

---

### US-007: Reset App State Between Runs ✅
**Implementation:** `src/core/device-manager.ts` (method: `resetApp`)

Complete state reset:
1. Terminate app process
2. Uninstall app
3. Reinstall app from bundle
4. Launch app

**Usage:**
```typescript
await deviceManager.resetApp(udid, bundleId, appPath);
```

Note: Automatically called by `aperture play` before each run.

---

### US-008: Interactive Setup Wizard + Project Configuration ✅
**Implementation:** `src/cli/commands/init.ts`, `src/config/`

Comprehensive project setup:
- Step-by-step guided configuration
- Auto-detection (bundle ID, Simulators)
- Multi-select locale picker (16 languages)
- Template style selector
- Optional guardrails configuration
- Zod schema validation

**CLI Command:**
```bash
aperture init                           # Interactive wizard
aperture init --yes --app ./MyApp.app   # Non-interactive
```

**Generated Config:**
```json
{
  "app": {
    "path": "./MyApp.app",
    "bundleId": "com.example.myapp"
  },
  "locales": ["en", "de", "fr"],
  "simulators": {
    "iphone": "UDID",
    "ipad": "UDID"
  },
  "templateStyle": "modern",
  "guardrails": {
    "maxSteps": 50,
    "stepTimeout": 10,
    "runTimeout": 300,
    "stepRetries": 2
  }
}
```

---

## 🏗️ Architecture Implemented

### Core Modules

1. **DeviceManager** - Simulator lifecycle
2. **WDAConnection** - WebDriverAgent wrapper
3. **Recorder** - Action capture engine
4. **Player** - Deterministic playback
5. **ScreenshotManager** - Screenshot capture
6. **ConfigManager** - Zod-validated config

### Type System

- `Recording` - Complete walkthrough data
- `Step` - Individual action with selector
- `ElementSelector` - Multi-method element identification
- `ScreenshotPoint` - Screenshot marker metadata
- `PlaybackResult` - Execution summary
- `StepResult` - Per-step execution status

### CLI Commands

All commands fully functional:
- `aperture init` - Project setup
- `aperture devices` - List Simulators
- `aperture record` - Capture walkthrough
- `aperture play` - Replay recording

---

## 📊 What Works Now

### Complete Workflow

```bash
# 1. Initialize project
aperture init

# 2. Start Appium server (separate terminal)
appium --port 8100

# 3. Record walkthrough
aperture record --name my-app-tour

# (Interact with app, mark screenshot points)
> screenshot welcome-screen
> screenshot features-list
> screenshot settings
> done

# 4. Replay and capture screenshots
aperture play my-app-tour

# Screenshots saved to: ./output/my-app-tour/*.png
```

---

## ⚙️ Technical Implementation

### WebDriverAgent Integration

Uses Appium XCUITest driver via webdriverio:
- Remote connection on port 8100
- XCUITest automation backend
- Accessibility tree access
- Element interaction (tap, type, swipe)
- Gesture support

### Selector Cascade Strategy

```typescript
1. Try cached selector (from AI)           → fastest
2. Try accessibilityIdentifier              → most stable
3. Try accessibilityLabel                   → fallback 1
4. Try label text matching                  → fallback 2
5. Try XPath                                → fragile
6. AI fallback (future: GPT-4o-mini)        → last resort
```

### Error Handling

All errors extend `ApertureError`:
- `DeviceError` - Simulator/app issues
- `StepFailedError` - Playback failures
- `ConfigError` - Configuration problems

Structured context for debugging:
```typescript
throw new StepFailedError(
  'Element not found',
  'SELECTOR_NOT_FOUND',
  { selector, step, tree }
);
```

---

## 🎯 Milestone 1: COMPLETE ✅

All 8 user stories implemented:
- ✅ US-001: Connect to Simulator
- ✅ US-002: Install app
- ✅ US-003: Record walkthrough
- ✅ US-004: Mark screenshots
- ✅ US-005: Replay recording
- ✅ US-006: Capture screenshots
- ✅ US-007: Reset app state
- ✅ US-008: Setup wizard

**Lines of Code:** ~2,500
**Modules:** 15
**Type Definitions:** 25+
**CLI Commands:** 4 functional

---

## 🚀 Next: Milestone 2

Ready to implement:
- US-009: AI Parameterization
- US-010: Locale-specific test data
- US-011: Simulator locale switching
- US-012: AI element fallback
- US-013: Deterministic verification
- US-014: Batch locale execution
- US-015: Safety guardrails (partially done)
- US-016: Selector caching

See [PRD](docs/prd.md) for full M2 requirements.
