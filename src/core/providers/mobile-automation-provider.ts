import type { AccessibilityNode, ScreenInfo } from '../../types/index.js';

/**
 * Abstract interface for mobile device automation providers
 *
 * This interface defines all operations needed for iOS automation,
 * allowing different MCP servers or automation backends to be used
 * interchangeably via the Adapter pattern.
 */
export interface IMobileAutomationProvider {
  // ── Connection Management ──────────────────────────────────────

  /**
   * Connect to the automation provider
   * @param endpoint - Provider-specific endpoint (e.g., "stdio://mobile-mcp")
   */
  connect(endpoint: string): Promise<void>;

  /**
   * Disconnect from the automation provider
   */
  disconnect(): Promise<void>;

  /**
   * Initialize a specific device for automation
   * @param udid - Device UDID
   */
  initializeDevice(udid: string): Promise<void>;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  // ── UI Inspection ──────────────────────────────────────────────

  /**
   * Get the accessibility tree of the current screen
   * @returns Root accessibility node with full UI hierarchy
   */
  getAccessibilityTree(): Promise<AccessibilityNode>;

  /**
   * Get screen information (dimensions, scale, orientation)
   * @returns Screen metadata
   */
  getScreenInfo(): Promise<ScreenInfo>;

  /**
   * Take a screenshot of the current screen
   * @returns PNG/JPEG image as Buffer
   */
  takeScreenshot(): Promise<Buffer>;

  // ── User Interaction ──────────────────────────────────────────

  /**
   * Tap an element by its accessibility ID
   * @param elementId - Element identifier from accessibility tree
   * @throws Error if element-based tapping not supported by provider
   */
  tap(elementId: string): Promise<void>;

  /**
   * Tap at specific screen coordinates
   * @param x - X coordinate (logical points)
   * @param y - Y coordinate (logical points)
   */
  tapCoordinates(x: number, y: number): Promise<void>;

  /**
   * Type text into the currently focused field
   * @param text - Text to type
   */
  type(text: string): Promise<void>;

  /**
   * Scroll in a direction
   * @param direction - Direction to scroll
   * @param amount - Distance in points (optional)
   */
  scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void>;

  /**
   * Perform swipe gesture
   * @param startX - Start X coordinate
   * @param startY - Start Y coordinate
   * @param endX - End X coordinate
   * @param endY - End Y coordinate
   */
  swipe(startX: number, startY: number, endX: number, endY: number): Promise<void>;

  /**
   * Press a system button
   * @param button - Button to press (home, back, etc.)
   * @throws Error if button not supported by provider
   */
  pressButton(button: 'home' | 'back'): Promise<void>;

  // ── App Lifecycle ──────────────────────────────────────────────

  /**
   * Launch an app by bundle ID
   * @param bundleId - App bundle identifier
   */
  launchApp(bundleId: string): Promise<void>;

  /**
   * Terminate an app by bundle ID
   * @param bundleId - App bundle identifier
   * @throws Error if not supported by provider (use DeviceManager fallback)
   */
  terminateApp(bundleId: string): Promise<void>;

  /**
   * Install an app
   * @param appPath - Path to .app bundle
   * @throws Error if not supported by provider (use DeviceManager fallback)
   */
  installApp(appPath: string): Promise<void>;

  /**
   * Uninstall an app by bundle ID
   * @param bundleId - App bundle identifier
   * @throws Error if not supported by provider (use DeviceManager fallback)
   */
  uninstallApp(bundleId: string): Promise<void>;

  // ── Debug & Utilities ──────────────────────────────────────────

  /**
   * List available automation capabilities/tools
   * @returns Array of capability names and descriptions
   */
  listCapabilities(): Promise<Array<{ name: string; description?: string }>>;

  /**
   * Get provider metadata
   * @returns Provider name and version info
   */
  getProviderInfo(): {
    name: string;
    version: string;
    supportsElementTap: boolean;
    supportsCoordinateTap: boolean;
    supportsAppLifecycle: boolean;
  };
}

/**
 * Configuration for creating a mobile automation provider
 */
export interface ProviderConfig {
  /** Provider type (e.g., "mobile-mcp", "appium", "maestro") */
  type: string;
  /** Provider-specific endpoint */
  endpoint: string;
  /** Additional provider options */
  options?: Record<string, unknown>;
}

/**
 * Error thrown when a provider doesn't support a specific operation
 */
export class UnsupportedOperationError extends Error {
  constructor(operation: string, provider: string, fallbackMessage?: string) {
    const message = fallbackMessage
      ? `${provider} does not support '${operation}'. ${fallbackMessage}`
      : `${provider} does not support '${operation}'`;
    super(message);
    this.name = 'UnsupportedOperationError';
  }
}
