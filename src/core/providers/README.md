# Mobile Automation Provider Abstraction

This directory contains the abstraction layer for mobile device automation, allowing Aperture to work with different automation backends interchangeably.

## Architecture

The provider abstraction follows the **Adapter Pattern**, enabling different mobile automation tools (MCP servers, Appium, Maestro, etc.) to be used without changing the core application logic.

```
┌─────────────────────────────────────────────┐
│         AINavigator / run.ts                │
│    (depends on IMobileAutomationProvider)   │
└─────────────────┬───────────────────────────┘
                  │
                  │ uses interface
                  ▼
┌─────────────────────────────────────────────┐
│    IMobileAutomationProvider (interface)    │
│  - connect(), disconnect(), initializeDevice│
│  - getAccessibilityTree(), takeScreenshot   │
│  - tap(), tapCoordinates(), type(), scroll  │
│  - swipe(), pressButton()                   │
│  - launchApp(), terminateApp(), etc.        │
└─────────────────┬───────────────────────────┘
                  │
                  │ implemented by
                  ▼
       ┌──────────┴──────────┐
       │                     │
┌──────▼───────┐    ┌────────▼────────┐
│  MobileMCP   │    │  Future:        │
│  Provider    │    │  - Appium       │
└──────────────┘    │  - Maestro      │
                    │  - Custom       │
                    └─────────────────┘
```

## Files

### `mobile-automation-provider.ts`
- **`IMobileAutomationProvider`**: Core interface defining all automation operations
- **`ProviderConfig`**: Configuration for creating providers
- **`UnsupportedOperationError`**: Error thrown when a provider doesn't support an operation

### `mobile-mcp-provider.ts`
- **`MobileMCPProvider`**: Adapter for `@mobilenext/mobile-mcp` server
- Implements all interface methods using MCP SDK
- Uses AppleScript for coordinate-based tapping (workaround for React Native apps without accessibility props)

### `provider-factory.ts`
- **`ProviderFactory`**: Factory for creating provider instances
- **`parseProviderType()`**: Auto-detects provider type from endpoint string
- **`createProviderFromEndpoint()`**: Convenience method for creating and connecting providers

### `index.ts`
- Exports all public interfaces and classes

## Usage

### Basic Usage

```typescript
import { ProviderFactory } from './core/providers';

// Create provider from config
const provider = ProviderFactory.create({
  type: 'mobile-mcp',
  endpoint: 'stdio://mcp-server-mobile'
});

// Connect and initialize
await provider.connect('stdio://mcp-server-mobile');
await provider.initializeDevice('9E18B379-A152-4A82-8C26-0C8BA160B2E5');

// Use provider
const tree = await provider.getAccessibilityTree();
await provider.tapCoordinates(100, 200);
const screenshot = await provider.takeScreenshot();

// Cleanup
await provider.disconnect();
```

### Auto-Detection from Endpoint

```typescript
import { createProviderFromEndpoint } from './core/providers';

// Automatically detects provider type and connects
const provider = await createProviderFromEndpoint('stdio://mcp-server-mobile');
await provider.initializeDevice(udid);
```

### Configuration File

```yaml
# aperture.config.yaml
mcp:
  endpoint: stdio://mcp-server-mobile  # Provider type auto-detected
```

The provider type is extracted from the endpoint:
- `stdio://mcp-server-mobile` → `mobile-mcp` provider (WebDriverAgent-based)
- `stdio://ios-simulator-mcp` → `ios-simulator-mcp` provider (idb-based)
- `stdio://appium` → `appium` provider (future)

### Choosing a Provider

**Use `mobile-mcp` (mcp-server-mobile) when:**
- Working with React Native apps (WebDriverAgent integration)
- Need full WebDriverAgent feature set
- App has proper accessibility labels

**Use `ios-simulator-mcp` when:**
- Native iOS apps or apps with accessibility issues
- Need app lifecycle control (install, launch)
- Working with coordinate-based automation
- React Native buttons without accessibility props (better native tap support)

**Installation:**

```bash
# For mobile-mcp
npm install -g @mobilenext/mobile-mcp

# For ios-simulator-mcp
npm install -g ios-simulator-mcp
# Or use npx (no installation needed)
```

## Adding a New Provider

To add support for a new automation backend (e.g., Appium), follow these steps:

### 1. Create Provider Adapter

Create a new file `src/core/providers/appium-provider.ts`:

```typescript
import type { IMobileAutomationProvider } from './mobile-automation-provider.js';
import type { AccessibilityNode, ScreenInfo } from '../../types/index.js';
import { UnsupportedOperationError } from './mobile-automation-provider.js';

export class AppiumProvider implements IMobileAutomationProvider {
  private driver: any = null;
  private connected = false;

  async connect(endpoint: string): Promise<void> {
    // Initialize Appium WebDriver client
    // Parse endpoint for Appium server URL
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
    }
    this.connected = false;
  }

  async initializeDevice(udid: string): Promise<void> {
    // Start Appium session for the device
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getAccessibilityTree(): Promise<AccessibilityNode> {
    // Use Appium's page source API
    const source = await this.driver.getPageSource();
    return this.parseAppiumTree(source);
  }

  async tapCoordinates(x: number, y: number): Promise<void> {
    // Use Appium's touch action
    await this.driver.touchAction([
      { action: 'tap', x, y }
    ]);
  }

  // Implement other required methods...

  async pressButton(button: 'home' | 'back'): Promise<void> {
    // Appium supports button presses
    await this.driver.execute('mobile: pressButton', { name: button });
  }

  getProviderInfo() {
    return {
      name: 'Appium WebDriver',
      version: '2.0.0',
      supportsElementTap: true,
      supportsCoordinateTap: true,
      supportsAppLifecycle: true,
    };
  }

  // Helper methods...
  private parseAppiumTree(xml: string): AccessibilityNode {
    // Convert Appium XML page source to AccessibilityNode tree
  }
}
```

### 2. Register Provider

Update `src/core/providers/provider-factory.ts`:

```typescript
import { AppiumProvider } from './appium-provider.js';

const PROVIDER_REGISTRY: Record<string, new () => IMobileAutomationProvider> = {
  'mobile-mcp': MobileMCPProvider,
  'mcp-server-mobile': MobileMCPProvider,
  'appium': AppiumProvider,  // ← Add this
};
```

### 3. Export Provider

Update `src/core/providers/index.ts`:

```typescript
export { AppiumProvider } from './appium-provider.js';
```

### 4. Use in Configuration

```yaml
# aperture.config.yaml
mcp:
  endpoint: stdio://appium  # Or HTTP endpoint like http://localhost:4723
```

## Provider Capabilities

Different providers may support different features. Use `getProviderInfo()` to check capabilities:

```typescript
const info = provider.getProviderInfo();

if (info.supportsElementTap) {
  // Can tap by element ID
  await provider.tap('button-login');
} else {
  // Must use coordinates
  await provider.tapCoordinates(100, 200);
}
```

### Handling Unsupported Operations

Providers should throw `UnsupportedOperationError` for operations they don't support:

```typescript
async installApp(appPath: string): Promise<void> {
  throw new UnsupportedOperationError(
    'installApp',
    'mobile-mcp',
    'Use DeviceManager.install() instead.'
  );
}
```

This allows callers to gracefully fall back to alternative methods.

## Provider Comparison

| Feature | MobileMCP | IOSSimulatorMCP | Appium (Future) | Maestro (Future) |
|---------|-----------|-----------------|-----------------|------------------|
| Accessibility Tree | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Element Tap | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Coordinate Tap | ✅ AppleScript | ✅ Native idb | ✅ Native | ✅ Native |
| Screenshot | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Type Text | ✅ Yes | ✅ ASCII only | ✅ Yes | ✅ Yes |
| Scroll/Swipe | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| App Lifecycle | ❌ No | ✅ Install/Launch | ✅ Yes | ✅ Yes |
| Button Press | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Backend | WebDriverAgent | iOS Debug Bridge | WDA/XCUITest | Custom |
| Best For | React Native | Native iOS apps | Cross-platform | React Native |

## Testing

When implementing a new provider, test all interface methods:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppiumProvider } from './appium-provider';

describe('AppiumProvider', () => {
  let provider: AppiumProvider;

  beforeAll(async () => {
    provider = new AppiumProvider();
    await provider.connect('http://localhost:4723');
  });

  afterAll(async () => {
    await provider.disconnect();
  });

  it('should connect successfully', () => {
    expect(provider.isConnected()).toBe(true);
  });

  it('should get accessibility tree', async () => {
    const tree = await provider.getAccessibilityTree();
    expect(tree.role).toBe('Window');
    expect(tree.children.length).toBeGreaterThan(0);
  });

  it('should tap coordinates', async () => {
    await expect(provider.tapCoordinates(100, 200)).resolves.not.toThrow();
  });

  // More tests...
});
```

## Design Principles

1. **Single Responsibility**: Each provider only handles communication with its backend
2. **Interface Segregation**: All providers implement the full interface (use `UnsupportedOperationError` for unsupported ops)
3. **Dependency Inversion**: High-level code (AINavigator) depends on abstractions, not concrete implementations
4. **Open/Closed**: Easy to add new providers without modifying existing code
5. **Liskov Substitution**: Any provider can replace another without breaking functionality

## Future Enhancements

- **Connection Pooling**: Reuse provider connections across runs
- **Provider Selection Strategy**: Auto-select best provider based on app characteristics
- **Provider Middleware**: Add logging, retry logic, rate limiting as middleware
- **Performance Metrics**: Track provider performance for debugging
- **Mock Provider**: For testing without real devices
