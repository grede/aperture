# Aperture — Future Enhancements

**Status:** Roadmap
**Last Updated:** 2026-02-14

This document outlines potential future enhancements and improvements to Aperture beyond the core Milestones 1-3 implementation.

---

## 🎨 Web UI (Milestone 3 Extension)

### Overview
While Milestone 3 delivered the REST API and job queue, a browser-based UI would make Aperture accessible to non-technical users and provide real-time job monitoring.

### Features

#### Job Management Dashboard
- **Job List View**
  - Table showing all jobs (pending, running, completed, failed)
  - Filters by status, date, locale
  - Search by job ID or app name
  - Real-time status updates via WebSocket

- **Job Creation Wizard**
  - Multi-step form for creating jobs
  - File upload for `.app` bundles
  - Monaco editor for flow YAML with syntax highlighting
  - Locale and device selection via checkboxes
  - Template style preview
  - Cost estimation before submission

#### Live Monitoring
- **Real-time Progress**
  - Current step being executed
  - Actions taken by AI navigator
  - LLM model used (gpt-4o-mini vs gpt-4o escalation)
  - Running cost counter

- **Simulator View**
  - WebSocket-streamed screenshots (1-2 fps)
  - Current locale and device displayed
  - Accessibility tree visualization (expandable JSON tree)

#### Screenshot Gallery
- **Grid View**
  - Thumbnails of all captured screenshots
  - Grouped by locale and device
  - Quick preview on hover
  - Download individual or bulk ZIP

- **Comparison Mode**
  - Side-by-side view of same screen across locales
  - Spot translation issues visually
  - Highlight differences

#### Settings & Configuration
- **Global Settings**
  - Default guardrails (action limits, timeouts, cost cap)
  - Default LLM models
  - Template style preferences
  - API key management

- **Team Management**
  - Multiple API keys with different permissions
  - Usage quotas per key
  - Audit log of API calls

### Technology Stack
- **Frontend**: Next.js 14+ (App Router)
- **UI Library**: Tailwind CSS + shadcn/ui components
- **Code Editor**: Monaco Editor (VS Code engine)
- **Real-time**: WebSocket (ws) + React hooks
- **State Management**: Zustand or TanStack Query
- **Charts**: Recharts for cost/usage analytics

### Implementation Priority
- **Phase 1**: Job dashboard + creation wizard
- **Phase 2**: Live monitoring + simulator view
- **Phase 3**: Screenshot gallery
- **Phase 4**: Advanced features (comparison, team management)

---

## 📱 Device Frame Assets

### Current State
The TemplateEngine currently composites screenshots without actual device frames — it uses positioning and backgrounds only.

### Enhancement
Add high-quality, license-free device frame PNGs for realistic App Store screenshots.

### Asset Sources
1. **Facebook Design Resources** (CC BY 4.0)
   - Device mockups for iPhone, iPad
   - Multiple colors (black, white, gold, etc.)
   - High resolution (2x, 3x)

2. **Custom SVG Frames**
   - Generate programmatically with Sharp
   - Fully customizable colors and shadows
   - No licensing issues

3. **Community Contributions**
   - Accept user-submitted frames via PR
   - Include attribution in metadata

### Frame Requirements
- **iPhone 15 Pro Max**: 1242×2688px screen area (6.5")
- **iPad Pro 13"**: 2048×2732px screen area
- Transparent background (PNG with alpha)
- Shadow/bezel included in frame
- Organized by device type and color

### Directory Structure
```
templates/
  assets/
    frames/
      iphone/
        iphone-15-pro-max-black.png
        iphone-15-pro-max-white.png
        iphone-15-pro-max-gold.png
      ipad/
        ipad-pro-13-black.png
        ipad-pro-13-white.png
```

### Implementation
- Update TemplateEngine to load and composite device frames
- Add `deviceFrame` option to CompositeOptions (color selection)
- Fallback to frameless mode if assets not found

---

## 🔧 Advanced Features

### 1. `.ipa` File Support

**Current Limitation**: Only `.app` bundles are supported (Xcode output).

**Enhancement**: Accept `.ipa` files (App Store archives).

**Implementation**:
- Extract `.ipa` to temp directory (it's a ZIP file)
- Locate embedded `.app` bundle inside `Payload/`
- Pass extracted `.app` path to DeviceManager
- Clean up temp directory after job completion

**Benefits**:
- Users can test with App Store builds
- CI/CD integration with archived builds
- TestFlight builds compatible

---

### 2. Custom Template Definitions

**Current State**: 5 built-in styles (minimal, modern, gradient, dark, playful).

**Enhancement**: User-defined templates via JSON configuration.

**Template Schema** (JSON):
```json
{
  "name": "my-custom-template",
  "background": {
    "type": "gradient",
    "colors": ["#FF6B6B", "#4ECDC4"],
    "angle": 45
  },
  "device": {
    "position": "center",
    "scale": 0.8,
    "rotation": -5,
    "shadow": {
      "offsetX": 20,
      "offsetY": 20,
      "blur": 40,
      "color": "rgba(0,0,0,0.3)"
    }
  },
  "text": {
    "position": "top",
    "titleFont": {
      "family": "Helvetica Neue",
      "size": 56,
      "weight": 700,
      "color": "#FFFFFF"
    },
    "subtitleFont": {
      "family": "Helvetica Neue",
      "size": 28,
      "weight": 400,
      "color": "#FFFFFF"
    },
    "padding": 60
  },
  "decorations": [
    {
      "type": "circle",
      "position": { "x": 100, "y": 100 },
      "radius": 50,
      "color": "#FFD93D",
      "opacity": 0.5
    }
  ]
}
```

**Benefits**:
- Brand-specific templates
- A/B testing different styles
- Seasonal/campaign-specific designs

---

### 3. Multi-Cluster Support

**Current State**: Single-machine server (Mac Mini M4 Pro).

**Enhancement**: Distribute jobs across multiple Mac Minis.

**Architecture**:
```
┌─────────────────┐
│  Load Balancer  │ (Nginx / HAProxy)
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │         │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│ Mac 1 │ │ Mac 2│ │ Mac 3│ │ Mac 4│
│ Pool: │ │Pool: │ │Pool: │ │Pool: │
│ 4 Sims│ │4 Sims│ │4 Sims│ │4 Sims│
└───────┘ └──────┘ └──────┘ └──────┘
         │
    ┌────▼─────┐
    │  Redis   │ (Shared job queue)
    └──────────┘
```

**Implementation**:
- Each Mac runs its own SimulatorPool
- Shared Redis instance for BullMQ
- Workers pull from same queue
- Load balancer routes API requests
- Health check reports cluster capacity

**Benefits**:
- Horizontal scaling (16+ concurrent jobs)
- Fault tolerance (one Mac down doesn't stop cluster)
- Geographic distribution (different regions)

---

### 4. Enhanced Error Recovery

**Current State**: Failed steps are logged and flow continues.

**Enhancement**: Intelligent retry strategies and recovery.

**Features**:

#### Smart Retries
- **Transient Errors**: Auto-retry (network timeouts, temporary MCP failures)
- **UI State Issues**: Wait and retry (animations not complete)
- **Navigation Failures**: Alternative strategies (try different element, use coordinates)

#### Recovery Actions
- **App Crash Detection**:
  - Detect via empty accessibility tree
  - Auto-relaunch app
  - Resume from last successful step

- **Simulator Crash**:
  - Detect via xcrun simctl status check
  - Auto-reboot simulator
  - Retry current step

- **LLM Rate Limits**:
  - Exponential backoff (1s, 2s, 4s, 8s, 16s)
  - Switch to backup API key if available
  - Queue job for retry after cooldown

#### Checkpoint System
- Save progress after each successful screenshot
- Resume from checkpoint on failure
- Avoid re-running completed locales/devices

**Configuration** (aperture.config.yaml):
```yaml
recovery:
  retryStrategies:
    networkErrors: 3
    uiStateIssues: 2
    navigationFailures: 1
  checkpointing:
    enabled: true
    saveAfterScreenshot: true
  fallbackBehaviors:
    appCrash: relaunch
    simulatorCrash: reboot
    llmRateLimit: exponentialBackoff
```

---

### 5. Advanced AI Navigator Features

#### Vision Fallback
- When accessibility tree is insufficient (games, custom UI):
  - Use GPT-4 Vision to analyze screenshot
  - Identify tap coordinates visually
  - Higher cost but more reliable for complex UIs

#### Learning from Success
- Store successful navigation paths per app
- Use past successes as context for future runs
- "Last time we navigated to Settings by tapping [element], try that first"

#### Multi-Step Planning
- Ask LLM to plan entire navigation upfront
- Verify each step but reduce LLM round-trips
- Faster execution for familiar flows

#### Natural Language Flow Authoring
- Accept natural language instead of YAML:
  ```
  "Start the app, dismiss any alerts, go to settings,
   take a screenshot, then open the profile screen"
  ```
- LLM converts to structured FlowDefinition
- Users don't need to learn YAML syntax

---

### 6. Analytics & Reporting

#### Cost Analytics
- Daily/weekly/monthly cost breakdown
- Cost per app, per locale
- Trends over time (costs increasing/decreasing)
- Budget alerts

#### Success Rate Tracking
- Navigate step success rate by app
- Identify problematic flows
- A/B test different instructions

#### Performance Metrics
- Average time per screenshot
- Bottleneck identification (slow steps)
- Simulator pool utilization
- Queue depth over time

#### Export Reports
- PDF reports for stakeholders
- CSV export for analysis
- Automated weekly email summaries

---

## 🔐 Security Enhancements

### 1. Secrets Management
- **Current**: API keys in environment variables
- **Enhancement**: Integration with HashiCorp Vault, AWS Secrets Manager
- Automatic key rotation
- Separate keys per environment (dev/staging/prod)

### 2. Input Validation
- Strict validation of flow YAML (prevent injection)
- Sanitize user-provided variables
- Limit file upload sizes
- Sandbox execution environments

### 3. Audit Logging
- Log all API calls with timestamps, user, action
- Track simulator access and changes
- Record LLM prompts and responses (for debugging)
- Compliance with SOC 2 / GDPR requirements

---

## 🌍 Localization Improvements

### 1. Auto-Detect Required Locales
- Parse App Store Connect metadata
- Suggest locales based on configured languages in app
- Warn if flow missing variables for configured locale

### 2. Translation Memory
- Cache translations across apps
- Reuse marketing copy for similar screenshots
- Reduce LLM API costs

### 3. Right-to-Left (RTL) Support
- Proper text alignment for Arabic, Hebrew
- Mirror device frames if needed
- Validate text rendering direction

---

## 🧪 Testing & Quality

### 1. Automated Testing
- Unit tests for core modules (FlowParser, AINavigator, etc.)
- Integration tests with mock MCP server
- E2E tests with real simulator
- Visual regression testing for templates

### 2. Flow Validation Tools
- `aperture validate-flow` command
- Dry-run with detailed step-by-step preview
- Estimate cost before execution
- Detect undefined variables

### 3. Screenshot Quality Checks
- Verify no UI elements are cut off
- Check text is readable (not too small)
- Detect blank screenshots (app crash)
- OCR-based content verification

---

## 📦 Distribution & Deployment

### 1. Docker Support
- Dockerfile for server
- Docker Compose with Redis
- Kubernetes manifests for cluster deployment

### 2. Homebrew Formula
- `brew install aperture`
- Auto-install dependencies
- Easy updates via `brew upgrade`

### 3. GitHub Actions Integration
- Pre-built workflows for CI/CD
- Automatic screenshot generation on PR
- Post screenshots as PR comments
- Upload to S3 or App Store Connect

---

## 🎓 Documentation & Community

### 1. Interactive Tutorial
- Step-by-step guide for first-time users
- Sample app with pre-configured flow
- Video walkthrough

### 2. Flow Template Library
- Community-contributed flow templates
- Common patterns (onboarding, settings, chat, etc.)
- Import via `aperture import-flow <url>`

### 3. Plugin System
- Allow custom actions beyond built-in (tap, type, scroll)
- Community-developed plugins
- Plugin registry

### 4. Discord Community
- Support channel
- Showcase screenshots generated by users
- Feature requests and feedback

---

## 🚀 Performance Optimizations

### 1. Parallel Locale Execution
- Run multiple locales simultaneously (if simulators available)
- Currently sequential: locale1 → locale2 → locale3
- Enhanced: locale1 + locale2 + locale3 (in parallel)

### 2. Incremental Screenshots
- Only regenerate screenshots for changed locales
- Cache unchanged screenshots
- Detect flow changes and invalidate cache

### 3. LLM Response Caching
- Cache LLM responses for identical accessibility trees
- Reduce API calls by ~30-50% for repetitive UIs
- Invalidate cache daily or on flow changes

### 4. Simulator Snapshots
- Save simulator state after app install + locale set
- Restore from snapshot instead of full reboot
- Faster locale switching (5s vs 20s)

---

## 📊 Priority Matrix

| Enhancement | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| Web UI Dashboard | High | High | **P0** |
| Device Frame Assets | Medium | Low | **P1** |
| .ipa File Support | Medium | Low | **P1** |
| Enhanced Error Recovery | High | Medium | **P1** |
| Vision Fallback | High | High | P2 |
| Multi-Cluster Support | Medium | High | P2 |
| Custom Templates | Low | Medium | P3 |
| Analytics & Reporting | Medium | Medium | P3 |

**P0**: Critical for production adoption
**P1**: Important for user experience
**P2**: Nice to have
**P3**: Future consideration

---

## 🤝 Contributing

If you'd like to contribute to any of these enhancements:

1. Open an issue to discuss your approach
2. Reference this document in your PR
3. Follow the existing code style and patterns
4. Add tests for new features
5. Update documentation

---

## 📝 Notes

- This document is a living roadmap and will be updated as priorities change
- Community feedback welcome via GitHub Issues
- Not all enhancements will be implemented — this is a wishlist
- PRs for any of these features are encouraged!

---

**Last Updated:** 2026-02-14
**Maintainer:** Aperture Team
**Feedback:** Open an issue or discussion on GitHub
