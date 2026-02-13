# US-023: Automated Appium Server Management

**Epic:** Developer Experience Improvements
**Priority:** High
**Milestone:** M1.5 (Quality of Life)
**Effort:** 2-3 days

---

## User Story

**As a** CLI user,
**I want** Aperture to automatically manage the Appium server lifecycle,
**So that** I don't need to manually install, start, and manage Appium as a separate dependency.

---

## Current Pain Points

Today, users must:
1. Know about Appium as a dependency
2. Install Appium globally: `npm install -g appium`
3. Install XCUITest driver: `appium driver install xcuitest`
4. Start Appium server manually in a separate terminal: `appium --port 8100`
5. Remember to stop the server when done
6. Troubleshoot connection issues if the server crashes

This creates significant friction and breaks the "it just works" experience.

---

## Proposed Solution

Aperture should:
- **Auto-detect** if Appium is installed
- **Auto-install** Appium locally (project-scoped, not global) if missing
- **Auto-start** Appium server in the background when needed
- **Auto-stop** Appium server when done
- **Health-check** the server and restart if it crashes
- **Handle port conflicts** by finding available ports
- **Provide visibility** into server status via CLI flags

---

## Acceptance Criteria

### AC-1: Automatic Dependency Detection
- [ ] On first `aperture record` or `aperture play`, system checks if Appium is available
- [ ] If Appium is not found, user is prompted: "Appium not installed. Install automatically? (Y/n)"
- [ ] If user agrees, Appium is installed locally in `node_modules/.bin/` (not globally)
- [ ] XCUITest driver is automatically installed alongside Appium
- [ ] Installation progress is shown with a spinner and estimated time
- [ ] If installation fails, clear error message with manual installation instructions

### AC-2: Automatic Server Lifecycle
- [ ] `aperture record` and `aperture play` automatically start Appium server if not running
- [ ] Server runs in background (detached process)
- [ ] Server logs are captured to `logs/appium-<timestamp>.log`
- [ ] Server is automatically stopped when CLI command completes
- [ ] If server is already running (port in use), system uses existing server
- [ ] Server process is properly cleaned up on Ctrl+C / SIGINT

### AC-3: Health Checks and Recovery
- [ ] Before starting recording/playback, system verifies Appium server is responsive
- [ ] HTTP health check to `http://localhost:8100/status`
- [ ] If server is unresponsive, system attempts restart (max 3 retries)
- [ ] If server repeatedly fails, system falls back to manual mode with clear instructions

### AC-4: Port Management
- [ ] Default port is 8100
- [ ] If port 8100 is occupied, system tries ports 8101-8110 sequentially
- [ ] Selected port is saved in `.aperture/appium.state` for session persistence
- [ ] User can override port via `--appium-port <port>` flag
- [ ] Port conflicts are detected before attempting to start server

### AC-5: User Control and Visibility
- [ ] `aperture server start` - Manually start Appium server
- [ ] `aperture server stop` - Manually stop Appium server
- [ ] `aperture server status` - Show server status (running/stopped, port, PID, uptime)
- [ ] `aperture server restart` - Restart server
- [ ] `aperture server logs` - Show recent server logs (tail -f mode)
- [ ] `--no-auto-appium` flag to disable automatic server management
- [ ] `--appium-port <port>` to specify custom port
- [ ] Verbose mode shows Appium server output in real-time

### AC-6: Clean Installation Workflow
```bash
# First-time user workflow
$ aperture record

Appium not installed. Appium is required for recording.
Install Appium automatically? (Y/n): y

Installing Appium...
✓ Appium installed (5.2s)
✓ XCUITest driver installed (3.1s)

Starting Appium server on port 8100...
✓ Appium server running (PID: 12345)

Recording Mode
─────────────────
...
```

### AC-7: Graceful Degradation
- [ ] If automatic installation fails, provide manual installation instructions
- [ ] If server won't start, fall back to manual mode with clear error
- [ ] System continues to work if user manually starts Appium
- [ ] All existing `--help` documentation is updated with server management info

---

## Technical Implementation

### Architecture

```
src/
├── core/
│   └── appium-manager.ts      # New: Appium lifecycle management
└── cli/
    └── commands/
        └── server.ts           # New: Server control commands
```

### AppiumManager Class

```typescript
class AppiumManager {
  // Installation
  async isInstalled(): Promise<boolean>
  async install(): Promise<void>
  async installDriver(driver: 'xcuitest'): Promise<void>

  // Lifecycle
  async start(port?: number): Promise<AppiumProcess>
  async stop(): Promise<void>
  async restart(): Promise<void>

  // Health
  async isRunning(): Promise<boolean>
  async healthCheck(): Promise<boolean>

  // Utilities
  async findAvailablePort(startPort: number): Promise<number>
  async getLogs(lines?: number): Promise<string>
  getStatus(): AppiumStatus
}

interface AppiumProcess {
  pid: number;
  port: number;
  startTime: Date;
  logFile: string;
}

interface AppiumStatus {
  running: boolean;
  port?: number;
  pid?: number;
  uptime?: number;
  version?: string;
}
```

### State Persistence

Create `.aperture/appium.state`:
```json
{
  "pid": 12345,
  "port": 8100,
  "startTime": "2026-02-13T16:00:00Z",
  "logFile": "logs/appium-1707840000.log"
}
```

### Process Management

Use `spawn` with detached mode:
```typescript
const appiumProcess = spawn('npx', ['appium', '--port', port.toString()], {
  detached: true,
  stdio: ['ignore', logStream, logStream],
});

// Unreference so parent can exit
appiumProcess.unref();
```

### Installation Strategy

**Option 1: Local npm install (Recommended)**
```bash
npm install --save-dev appium @appium/xcuitest-driver
npx appium driver install xcuitest
```

**Option 2: Global install fallback**
```bash
npm install -g appium
appium driver install xcuitest
```

### Integration with Existing Commands

Update `recordCommand` and `playCommand`:
```typescript
export async function recordCommand(options: RecordOptions) {
  // ... existing code ...

  // NEW: Automatic Appium management
  if (!options.noAutoAppium) {
    const appiumManager = new AppiumManager();

    if (!await appiumManager.isInstalled()) {
      const { install } = await inquirer.prompt([{
        type: 'confirm',
        name: 'install',
        message: 'Appium not installed. Install automatically?',
        default: true,
      }]);

      if (install) {
        await appiumManager.install();
      } else {
        // Show manual instructions
        return;
      }
    }

    // Start server if not running
    if (!await appiumManager.isRunning()) {
      await appiumManager.start(options.appiumPort);
    }
  }

  // ... rest of recording logic ...
}
```

---

## CLI Commands

### New Commands

```bash
# Server management
aperture server start [--port <port>]
aperture server stop
aperture server restart
aperture server status
aperture server logs [--follow] [--lines <n>]

# Installation
aperture server install [--global]
aperture server uninstall
```

### Updated Commands

```bash
# Existing commands with new flags
aperture record [--no-auto-appium] [--appium-port <port>]
aperture play <recording> [--no-auto-appium] [--appium-port <port>]
```

---

## User Experience Examples

### Example 1: First-Time User
```bash
$ aperture init
# ... config setup ...

$ aperture record

⚠ Appium is required for recording but not installed.

Appium is an automation framework for iOS apps.
Aperture can install it automatically.

Install Appium? (Y/n): y

Installing Appium...
✓ Appium v2.11.5 installed (5.2s)
✓ XCUITest driver installed (3.1s)

Starting Appium server on port 8100...
✓ Appium server running (PID: 12345)
  View logs: aperture server logs

Recording Mode
─────────────────
Recording name: my-app
...
```

### Example 2: Experienced User with Manual Control
```bash
# Start server manually with custom port
$ aperture server start --port 9000
✓ Appium server started on port 9000 (PID: 54321)

# Record with existing server
$ aperture record --name my-tour
✓ Using existing Appium server on port 9000
...

# Stop server when done
$ aperture server stop
✓ Appium server stopped
```

### Example 3: Server Crash Recovery
```bash
$ aperture play my-tour

Starting Appium server...
✗ Failed to start Appium server

Retrying... (1/3)
✓ Appium server running on port 8101

Playback Mode
─────────────
...
```

---

## Configuration

Add to `aperture.config.json`:
```json
{
  "appium": {
    "autoManage": true,
    "port": 8100,
    "installScope": "local",
    "logLevel": "error",
    "args": []
  }
}
```

---

## Testing Strategy

### Unit Tests
- AppiumManager.isInstalled() detects both local and global
- AppiumManager.findAvailablePort() handles occupied ports
- AppiumManager.healthCheck() validates server response

### Integration Tests
- Install → start → health check → stop workflow
- Server restart on crash
- Port conflict resolution
- Process cleanup on Ctrl+C

### Manual Tests
- First-time installation flow
- Recording with auto-started server
- Playback with existing server
- Server logs viewing
- Manual server control

---

## Rollout Plan

### Phase 1: Core Infrastructure (Day 1)
- Implement AppiumManager class
- Basic start/stop/status functionality
- Process management and cleanup

### Phase 2: Installation (Day 2)
- Automatic installation detection
- Local npm install workflow
- Interactive prompts

### Phase 3: Integration (Day 3)
- Update record/play commands
- Add server CLI commands
- Error handling and recovery

### Phase 4: Polish (Day 4)
- Comprehensive error messages
- Logging and diagnostics
- Documentation updates

---

## Documentation Updates

### README.md
Remove manual Appium setup instructions, replace with:
```markdown
## Quick Start

```bash
# Initialize project (one-time setup)
aperture init

# Record walkthrough (Appium installed automatically)
aperture record

# Replay and capture screenshots
aperture play my-recording
```

Aperture automatically manages Appium for you! 🎉
```

### CLAUDE.md
Update with AppiumManager architecture and usage patterns.

### New: TROUBLESHOOTING.md
Add section on Appium server issues and manual control.

---

## Success Metrics

- **Installation Success Rate:** >95% automatic installations succeed
- **Time to First Recording:** <2 minutes from `aperture init` to recording
- **Server Uptime:** >99% server runs without crashes during typical recording session
- **User Confusion:** <5% of users need to manually manage Appium

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| npm install fails | High | Graceful fallback to manual install with clear instructions |
| Port conflicts | Medium | Auto-detect and try alternative ports 8100-8110 |
| Process orphaning | Medium | Implement proper cleanup handlers (SIGINT, SIGTERM, exit) |
| Version conflicts | Low | Pin Appium version, document compatible versions |
| Slow installation | Low | Show progress, provide option to continue in background |

---

## Open Questions

1. **Scope:** Install locally (project-level) or globally?
   - **Recommendation:** Local by default, global as fallback
   - **Rationale:** Avoids version conflicts between projects

2. **Updates:** How to handle Appium updates?
   - **Recommendation:** Prompt user when new version available
   - **Command:** `aperture server update`

3. **Platform Support:** Does this work on Windows?
   - **Recommendation:** Test on Windows, document known issues
   - **Fallback:** Manual installation on unsupported platforms

4. **Resource Usage:** Should server stay running between commands?
   - **Recommendation:** Stop by default, add `--keep-alive` flag
   - **Rationale:** Save resources when not in use

5. **Multiple Projects:** How to handle multiple Aperture projects?
   - **Recommendation:** One server per project (different ports)
   - **State file:** `.aperture/appium.state` is project-specific

---

## Dependencies

- **npm/yarn:** For installing Appium programmatically
- **find-free-port:** For port availability checking
- **tree-kill:** For proper process cleanup
- **pidtree:** For finding child processes

Add to package.json:
```json
{
  "dependencies": {
    "find-free-port": "^2.0.0",
    "tree-kill": "^1.2.2"
  },
  "devDependencies": {
    "appium": "^2.11.5"
  }
}
```

---

## Future Enhancements (Post-M1.5)

- **US-024:** WebDriverAgent automatic installation and management
- **US-025:** One-click setup for all dependencies (Xcode CLI tools, Simulators)
- **US-026:** Cloud-based recording (no local Appium needed)
- **US-027:** Appium server monitoring dashboard (CPU, memory, logs)
- **US-028:** Multi-version Appium support for testing compatibility

---

## Acceptance Testing

**Given** a new user with no Appium installation
**When** they run `aperture record`
**Then** they should be prompted to install Appium
**And** installation should complete automatically
**And** server should start without manual intervention
**And** recording should begin seamlessly

**Given** an experienced user with Appium manually running
**When** they run `aperture record --no-auto-appium`
**Then** the system should use the existing server
**And** not attempt to start a new server
**And** not stop the server when recording finishes

**Given** the Appium server crashes mid-recording
**When** the system detects the crash
**Then** it should attempt to restart the server
**And** resume recording without data loss
**Or** gracefully fail with diagnostic information
