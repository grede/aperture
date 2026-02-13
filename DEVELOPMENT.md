# Development Guide

This guide covers the initial bootstrap and what's been implemented so far.

## Current Status

**Milestone 1 Progress:**
- ✅ US-001: Connect to Local iOS Simulator
- ✅ US-002: Install Target App on Simulator
- ✅ US-008: Interactive Setup Wizard + Project Configuration
- ⏳ US-003: Record a Manual Walkthrough (not yet implemented)
- ⏳ US-004: Mark Screenshot Points (not yet implemented)
- ⏳ US-005: Replay a Recording (not yet implemented)
- ⏳ US-006: Capture Screenshots (not yet implemented)
- ⏳ US-007: Reset App State (implemented in DeviceManager, not exposed in CLI)

## What's Been Built

### 1. Project Structure

```
aperture/
├── src/
│   ├── types/           # TypeScript type definitions
│   │   ├── errors.ts    # Structured error classes
│   │   ├── device.ts    # Simulator device types
│   │   ├── recording.ts # Recording and step types
│   │   ├── config.ts    # Configuration types
│   │   └── index.ts     # Type exports
│   ├── utils/           # Utility modules
│   │   ├── logger.ts    # Pino structured logging
│   │   ├── exec.ts      # Safe command execution (execFile)
│   │   ├── retry.ts     # Retry with exponential backoff
│   │   ├── hash.ts      # Hashing utilities
│   │   └── index.ts     # Utility exports
│   ├── config/          # Configuration management
│   │   ├── schema.ts    # Zod validation schema
│   │   └── index.ts     # Config loader/saver
│   ├── core/            # Core business logic
│   │   └── device-manager.ts  # Simulator lifecycle management
│   └── cli/             # CLI interface
│       ├── ui.ts        # UI helpers (ora, chalk)
│       ├── commands/
│       │   ├── init.ts  # Interactive setup wizard
│       │   └── devices.ts # List simulators
│       └── index.ts     # Commander.js setup
├── dist/                # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
├── CLAUDE.md            # Project guide for future Claude instances
└── DEVELOPMENT.md       # This file
```

### 2. Implemented Modules

#### DeviceManager (US-001, US-002)
Located in `src/core/device-manager.ts`

**Capabilities:**
- List all iOS Simulators (booted or all)
- Get specific device by UDID
- Boot/shutdown Simulators
- Wait for boot completion with timeout
- Install apps (.app or .ipa)
- Uninstall apps
- Launch/terminate apps
- Reset app state (uninstall → install → launch)
- Extract bundle ID from Info.plist
- Handle .ipa extraction

**Key Methods:**
```typescript
await deviceManager.listDevices(bootedOnly?: boolean)
await deviceManager.getDevice(udid: string)
await deviceManager.bootDevice(udid: string, timeout?: number)
await deviceManager.installApp(udid: string, appPath: string)
await deviceManager.resetApp(udid: string, bundleId: string, appPath: string)
```

#### Interactive Setup Wizard (US-008)
Located in `src/cli/commands/init.ts`

**Features:**
- Step-by-step guided setup
- Auto-detection of bundle ID
- Multi-select locale picker (16 common languages)
- Simulator selection from available devices
- Template style chooser (5 built-in styles)
- Optional guardrails configuration
- Configuration summary and confirmation
- Saves to `aperture.config.json`
- Non-interactive mode with `--yes` flag

**Usage:**
```bash
# Interactive wizard
aperture init

# Non-interactive with defaults
aperture init --yes --app ./MyApp.app
```

#### Configuration System
Located in `src/config/`

**Features:**
- Zod schema validation
- Type-safe configuration
- Default value merging
- Detailed validation errors
- Config file I/O

**Example Config:**
```json
{
  "app": {
    "path": "./MyApp.app",
    "bundleId": "com.example.myapp"
  },
  "locales": ["en", "de", "fr"],
  "simulators": {
    "iphone": "UDID-HERE",
    "ipad": "UDID-HERE"
  },
  "templateStyle": "modern",
  "outputDir": "./output",
  "guardrails": {
    "maxSteps": 50,
    "stepTimeout": 10,
    "runTimeout": 300,
    "stepRetries": 2
  }
}
```

### 3. CLI Commands

Currently implemented:
```bash
# Show help
aperture --help

# Initialize project (interactive wizard)
aperture init

# Initialize with defaults
aperture init --yes --app ./MyApp.app

# List all Simulators
aperture devices

# List booted Simulators only
aperture devices --booted

# List as JSON
aperture devices --json
```

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Link for global usage (makes 'aperture' command available)
npm link

# Development mode (watch and auto-rebuild)
npm run dev

# Run linter
npm run lint
npm run lint:fix

# Format code
npm run format

# Type check (without emitting files)
npm run typecheck

# Unlink global package (when done)
npm unlink -g aperture
```

## Testing the Implementation

### Setup

After building the project, link it globally for development:

```bash
# Build and link globally
npm run build
npm link

# Now you can use 'aperture' command directly
```

### 1. Test Device Manager

```bash
# List all Simulators
aperture devices

# List only booted devices
aperture devices --booted

# Output as JSON
aperture devices --json
```

### 2. Test Init Wizard

```bash
# Make sure you have:
# - At least one iOS Simulator installed
# - A .app bundle ready

# Run the interactive wizard
aperture init

# Or use defaults (non-interactive)
aperture init --yes --app /path/to/MyApp.app
```

## Next Steps for Implementation

### Immediate Priority (to complete M1):

1. **US-003: Record a Manual Walkthrough**
   - Implement WebDriverAgent connection
   - Create Recorder class in `src/core/recorder.ts`
   - Capture actions (tap, type, scroll)
   - Capture accessibility tree snapshots
   - Save recording to JSON

2. **US-004: Mark Screenshot Points**
   - Add screenshot marker to Recorder
   - Store screenshot metadata
   - Keyboard shortcut handler

3. **US-005: Replay a Recording**
   - Implement Player class in `src/core/player.ts`
   - Element location via selector cascade
   - Action execution via WebDriverAgent
   - Deterministic verification

4. **US-006: Capture Screenshots**
   - Use `xcrun simctl io booted screenshot`
   - Save to output directory
   - Hide status bar option

### Dependencies Needed

For US-003 onwards, you'll need:
- **WebDriverAgent** running on the Simulator
- **Appium Server** (installed but not configured yet)
- Integration with `webdriverio` client library

### Files to Create

```
src/core/
├── recorder.ts          # US-003, US-004
├── player.ts            # US-005
└── screenshot.ts        # US-006

src/cli/commands/
├── record.ts            # CLI for recorder
└── play.ts              # CLI for player
```

## Architecture Notes

### Type Safety
All types are centralized in `src/types/` and strictly validated. The Zod schema in `src/config/schema.ts` ensures runtime validation matches compile-time types.

### Error Handling
Structured errors extend `ApertureError` with:
- `code`: Machine-readable error code
- `context`: Debugging metadata
- Specific error classes per domain (DeviceError, ConfigError, etc.)

### Logging
Uses Pino for structured logging:
- Debug logs include full context
- Separate log levels for console vs file
- Run-specific log files in `logs/`

### Command Execution
All `xcrun` commands use the safe `execFile` wrapper in `src/utils/exec.ts`:
- No shell injection vulnerabilities
- Proper timeout handling
- Retry support via `utils/retry.ts`

### Simulator Management
The DeviceManager handles the full lifecycle:
- Boot/shutdown with state polling
- App installation with .ipa extraction
- Bundle ID auto-detection
- Comprehensive error reporting

## Known Limitations (To Address)

1. **No WebDriverAgent integration yet** - Required for US-003+
2. **Bundle ID detection limited** - Works for .app, placeholder for .ipa
3. **No iPad-specific recording logic** - DeviceManager supports it but not exposed in workflow
4. **No tests yet** - Test infrastructure is set up but no tests written

## Resources

- [PRD](docs/prd.md) - Complete product requirements
- [CLAUDE.md](CLAUDE.md) - Architectural guide
- [WebDriverAgent Docs](https://github.com/appium/WebDriverAgent)
- [Appium XCUITest Driver](https://github.com/appium/appium-xcuitest-driver)
