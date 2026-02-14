# Provider Abstraction Layer - Implementation Summary

## What Changed

We've decoupled the mobile automation backend from the core Aperture application logic by introducing a provider abstraction layer. This allows you to easily swap between different MCP servers or automation tools without changing application code.

## Motivation

**Problem**: The codebase was tightly coupled to `@mobilenext/mobile-mcp`, making it impossible to try alternative automation backends (like different MCP servers, Appium, Maestro) to solve issues with iOS simulator clicks not working.

**Solution**: Introduce the Adapter pattern with a common `IMobileAutomationProvider` interface that any automation backend can implement.

## Architecture Changes

### Before (Tightly Coupled)

```
AINavigator ──────> MCPClient ──────> @mobilenext/mobile-mcp
run.ts      ──────> MCPClient ──────> @mobilenext/mobile-mcp
```

All code directly referenced `MCPClient`, making it impossible to swap implementations.

### After (Abstraction Layer)

```
AINavigator ──────> IMobileAutomationProvider (interface)
                            │
                            ├──> MobileMCPProvider ──────> @mobilenext/mobile-mcp
                            ├──> AppiumProvider (future)
                            └──> MaestroProvider (future)
```

Code depends on the interface, not concrete implementations.

## Files Changed

### New Files Created

| File | Purpose |
|------|---------|
| `src/core/providers/mobile-automation-provider.ts` | Core interface and types |
| `src/core/providers/mobile-mcp-provider.ts` | Adapter for mobile-mcp |
| `src/core/providers/provider-factory.ts` | Factory for creating providers |
| `src/core/providers/index.ts` | Public exports |
| `src/core/providers/README.md` | Documentation |
| `docs/PROVIDER_ABSTRACTION.md` | This file |

### Files Modified

| File | Changes |
|------|---------|
| `src/core/ai-navigator.ts` | Changed parameter from `MCPClient` to `IMobileAutomationProvider` |
| `src/cli/commands/run.ts` | Uses `ProviderFactory` instead of direct `MCPClient` instantiation |
| `test_project/aperture.config.yaml` | Added comments about provider auto-detection |

### Files NOT Changed (Important!)

- `src/core/mcp-client.ts` - **Kept for reference** (contains all the mobile-mcp integration logic that was moved to `MobileMCPProvider`)
- All other core files remain unchanged

## Key Interfaces

### IMobileAutomationProvider

The core interface that all providers must implement:

```typescript
interface IMobileAutomationProvider {
  // Connection
  connect(endpoint: string): Promise<void>;
  disconnect(): Promise<void>;
  initializeDevice(udid: string): Promise<void>;
  isConnected(): boolean;

  // UI Inspection
  getAccessibilityTree(): Promise<AccessibilityNode>;
  getScreenInfo(): Promise<ScreenInfo>;
  takeScreenshot(): Promise<Buffer>;

  // Interaction
  tap(elementId: string): Promise<void>;
  tapCoordinates(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void>;
  swipe(startX: number, startY: number, endX: number, endY: number): Promise<void>;
  pressButton(button: 'home' | 'back'): Promise<void>;

  // App Lifecycle
  launchApp(bundleId: string): Promise<void>;
  terminateApp(bundleId: string): Promise<void>;
  installApp(appPath: string): Promise<void>;
  uninstallApp(bundleId: string): Promise<void>;

  // Utilities
  listCapabilities(): Promise<Array<{ name: string; description?: string }>>;
  getProviderInfo(): ProviderInfo;
}
```

## How to Use

### Current Usage (No Changes Needed for Users)

The abstraction is transparent to end users. Configuration remains the same:

```yaml
# aperture.config.yaml
mcp:
  endpoint: stdio://mcp-server-mobile  # Uses mobile-mcp (WebDriverAgent)
```

Or try the alternative provider:

```yaml
# aperture.config.yaml
mcp:
  endpoint: stdio://ios-simulator-mcp  # Uses ios-simulator-mcp (native idb)
```

The provider type is auto-detected from the endpoint string.

### Available Providers

**1. mobile-mcp (mcp-server-mobile)**
- Backend: WebDriverAgent
- Best for: React Native apps with accessibility labels
- Install: `npm install -g @mobilenext/mobile-mcp`

**2. ios-simulator-mcp**
- Backend: iOS Debug Bridge (idb)
- Best for: Native iOS apps, coordinate-based automation, apps without accessibility labels
- Install: `npm install -g ios-simulator-mcp` or use `npx` (no installation)
- **Key advantage**: Native iOS accessibility tapping may work better with React Native buttons that don't respond to WebDriverAgent

### Programmatic Usage

If you're using Aperture programmatically:

```typescript
import { ProviderFactory } from './core/providers';

// Create provider
const provider = ProviderFactory.create({
  type: 'mobile-mcp',
  endpoint: 'stdio://mcp-server-mobile'
});

// Connect
await provider.connect('stdio://mcp-server-mobile');
await provider.initializeDevice(deviceUdid);

// Use it
const tree = await provider.getAccessibilityTree();
await provider.tapCoordinates(100, 200);

// Cleanup
await provider.disconnect();
```

## How to Add a New Provider

See `src/core/providers/README.md` for detailed instructions. Brief overview:

1. **Create adapter**: Implement `IMobileAutomationProvider` in a new file
2. **Register**: Add to `PROVIDER_REGISTRY` in `provider-factory.ts`
3. **Export**: Add to `index.ts`
4. **Use**: Update config `endpoint` to point to your provider

Example for adding Playwright MCP support:

```typescript
// src/core/providers/playwright-mcp-provider.ts
export class PlaywrightMCPProvider implements IMobileAutomationProvider {
  // Implement all interface methods...
}

// src/core/providers/provider-factory.ts
const PROVIDER_REGISTRY = {
  'mobile-mcp': MobileMCPProvider,
  'mcp-server-mobile': MobileMCPProvider,
  'playwright-mcp': PlaywrightMCPProvider,  // ← Add this
};

// aperture.config.yaml
mcp:
  endpoint: stdio://playwright-mcp  # ← Provider auto-detected
```

## Benefits

### 1. **Easy Provider Switching**
Try different MCP servers to find one that solves the tap/click issue:
```yaml
# Try mobile-mcp
endpoint: stdio://mcp-server-mobile

# Or try playwright-mcp (future)
endpoint: stdio://playwright-mcp

# Or try appium (future)
endpoint: http://localhost:4723
```

### 2. **Provider-Specific Capabilities**
Each provider can advertise what it supports:
```typescript
const info = provider.getProviderInfo();
console.log(info.supportsCoordinateTap); // true/false
```

### 3. **Graceful Degradation**
Providers throw `UnsupportedOperationError` for missing features:
```typescript
try {
  await provider.pressButton('home');
} catch (error) {
  if (error instanceof UnsupportedOperationError) {
    // Fall back to DeviceManager
    await deviceManager.pressButton('home');
  }
}
```

### 4. **Testability**
Create mock providers for testing:
```typescript
class MockProvider implements IMobileAutomationProvider {
  async getAccessibilityTree() {
    return mockTree;
  }
  // ...
}
```

### 5. **Future-Proof**
Add support for new automation tools without touching existing code.

## Migration Guide

### For Developers

If you have custom code using `MCPClient`:

**Before:**
```typescript
import { MCPClient } from './core/mcp-client.js';

const mcpClient = new MCPClient();
await mcpClient.connect('stdio://mcp-server-mobile');
await mcpClient.initializeDevice(udid);
const tree = await mcpClient.getAccessibilityTree();
```

**After:**
```typescript
import { ProviderFactory } from './core/providers/index.js';

const provider = ProviderFactory.create({
  type: 'mcp-server-mobile',
  endpoint: 'stdio://mcp-server-mobile'
});
await provider.connect('stdio://mcp-server-mobile');
await provider.initializeDevice(udid);
const tree = await provider.getAccessibilityTree();
```

Or use the convenience method:
```typescript
import { createProviderFromEndpoint } from './core/providers/index.js';

const provider = await createProviderFromEndpoint('stdio://mcp-server-mobile');
await provider.initializeDevice(udid);
const tree = await provider.getAccessibilityTree();
```

### For End Users

**No changes needed!** The CLI commands work exactly the same:
```bash
aperture run
aperture run --locale en-US
```

Configuration files remain unchanged:
```yaml
mcp:
  endpoint: stdio://mcp-server-mobile
```

## Implementation Details

### Provider Registry

The factory uses a registry pattern for extensibility:

```typescript
const PROVIDER_REGISTRY: Record<string, new () => IMobileAutomationProvider> = {
  'mobile-mcp': MobileMCPProvider,
  'mcp-server-mobile': MobileMCPProvider, // Alias
  // Future providers added here
};
```

### Endpoint Parsing

Provider type is extracted from the endpoint:
```typescript
// stdio://mcp-server-mobile → "mcp-server-mobile"
// stdio://playwright-mcp → "playwright-mcp"
// http://localhost:4723 → "localhost:4723" (would need custom handling)
```

### Error Handling

Providers use a custom error class for unsupported operations:
```typescript
throw new UnsupportedOperationError(
  'installApp',
  'mobile-mcp',
  'Use DeviceManager.install() instead.'
);
```

This allows callers to distinguish between "not supported" vs "failed".

## Testing

All type checks pass:
```bash
npm run typecheck  # ✅ Passes
npm run build      # ✅ Passes
```

## Next Steps

1. **Try alternative MCP servers**: With the abstraction in place, you can now create adapters for other MCP servers that might handle iOS clicks differently.

2. **Implement Appium provider**: If MCP servers don't solve the click issue, implement an Appium adapter which uses native iOS click mechanisms.

3. **Implement Maestro provider**: Maestro is designed for React Native and might handle unlabeled buttons better.

4. **Add provider benchmarking**: Compare performance/reliability across providers.

## Questions?

See:
- `src/core/providers/README.md` - Detailed provider documentation
- `src/core/providers/mobile-automation-provider.ts` - Interface definition
- `src/core/providers/mobile-mcp-provider.ts` - Example implementation
