import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AccessibilityNode, ScreenInfo } from '../../types/index.js';
import type { IMobileAutomationProvider } from './mobile-automation-provider.js';
import { UnsupportedOperationError } from './mobile-automation-provider.js';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Mobile automation provider implementation for ios-simulator-mcp
 *
 * This adapter wraps the MCP SDK to provide iOS automation via native
 * iOS accessibility APIs (not WebDriverAgent). Uses idb (iOS Debug Bridge)
 * for direct simulator control.
 *
 * Key differences from mobile-mcp:
 * - Native iOS accessibility tapping (may work better with React Native)
 * - Built-in app lifecycle support (install, launch, terminate)
 * - Screenshot saved to file instead of base64 return
 * - Direct coordinate-based interaction without WDA
 *
 * GitHub: https://github.com/joshuayoes/ios-simulator-mcp
 */
export class IOSSimulatorMCPProvider implements IMobileAutomationProvider {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private deviceUdid: string | null = null;

  // ── Connection Management ──────────────────────────────────────

  async connect(endpoint: string): Promise<void> {
    if (this.connected) {
      return;
    }

    // Parse endpoint (format: "stdio://ios-simulator-mcp" or "npx ios-simulator-mcp")
    let command: string;
    let args: string[] = [];

    if (endpoint.startsWith('stdio://')) {
      command = endpoint.replace('stdio://', '');
    } else if (endpoint.startsWith('npx ')) {
      // Support "npx ios-simulator-mcp" format
      const parts = endpoint.split(' ');
      command = parts[0];
      args = parts.slice(1);
    } else {
      command = endpoint;
    }

    // Default to npx if just the package name
    if (command === 'ios-simulator-mcp') {
      command = 'npx';
      args = ['-y', 'ios-simulator-mcp'];
    }

    // Create stdio transport
    this.transport = new StdioClientTransport({
      command,
      args,
    });

    // Create MCP client
    this.client = new Client(
      {
        name: 'aperture',
        version: '0.2.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client?.close();
    this.connected = false;
    this.client = null;
    this.transport = null;
  }

  async initializeDevice(udid: string): Promise<void> {
    this.ensureConnected();
    this.deviceUdid = udid;

    // Verify device is accessible by getting its description
    // This is a lightweight call to ensure the simulator is ready
    await this.callTool('ui_describe_all', { udid });
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── UI Inspection ──────────────────────────────────────────────

  async getAccessibilityTree(): Promise<AccessibilityNode> {
    this.ensureConnected();

    const result = await this.callTool('ui_describe_all', {
      udid: this.deviceUdid
    });

    return this.parseAccessibilityTree(result);
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    this.ensureConnected();

    // ios-simulator-mcp doesn't provide screen info directly
    // Return default iPhone screen info
    return {
      width: 430,
      height: 932,
      scale: 3,
      orientation: 'portrait'
    };
  }

  async takeScreenshot(): Promise<Buffer> {
    this.ensureConnected();

    // ios-simulator-mcp saves screenshots to file, so we need to use a temp file
    const tempPath = join(tmpdir(), `aperture-screenshot-${Date.now()}.png`);

    try {
      await this.callTool('screenshot', {
        udid: this.deviceUdid,
        output_path: tempPath,
        type: 'png'
      });

      // Read the file
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(tempPath);

      // Clean up temp file
      await unlink(tempPath).catch(() => {
        // Ignore cleanup errors
      });

      return buffer;
    } catch (error) {
      // Attempt cleanup on error
      await unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  // ── User Interaction ──────────────────────────────────────────

  async tap(elementId: string): Promise<void> {
    this.ensureConnected();
    // ios-simulator-mcp doesn't support element_id tapping
    throw new UnsupportedOperationError(
      'tap(elementId)',
      'ios-simulator-mcp',
      'Use tapCoordinates() with x,y from element frame.'
    );
  }

  async tapCoordinates(x: number, y: number): Promise<void> {
    this.ensureConnected();

    await this.callTool('ui_tap', {
      udid: this.deviceUdid,
      x,
      y,
      // Default tap duration (can be customized if needed)
      duration: '0.1'
    });

    // Small delay for UI to respond
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async type(text: string): Promise<void> {
    this.ensureConnected();

    // ios-simulator-mcp only supports ASCII printable characters
    // Filter out non-ASCII characters and warn if any were removed
    const asciiText = text.replace(/[^\x20-\x7E]/g, '');

    if (asciiText !== text) {
      console.warn('[ios-simulator-mcp] Non-ASCII characters removed from text input');
    }

    await this.callTool('ui_type', {
      udid: this.deviceUdid,
      text: asciiText
    });
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void> {
    this.ensureConnected();

    // Convert scroll to swipe coordinates
    // Use standard iPhone dimensions
    const screenWidth = 430;
    const screenHeight = 932;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    const scrollDistance = amount ?? 200;

    let x_start = centerX;
    let y_start = centerY;
    let x_end = centerX;
    let y_end = centerY;

    switch (direction) {
      case 'up':
        y_start = centerY + scrollDistance;
        y_end = centerY - scrollDistance;
        break;
      case 'down':
        y_start = centerY - scrollDistance;
        y_end = centerY + scrollDistance;
        break;
      case 'left':
        x_start = centerX + scrollDistance;
        x_end = centerX - scrollDistance;
        break;
      case 'right':
        x_start = centerX - scrollDistance;
        x_end = centerX + scrollDistance;
        break;
    }

    await this.callTool('ui_swipe', {
      udid: this.deviceUdid,
      x_start,
      y_start,
      x_end,
      y_end,
      duration: '0.3',
      delta: 10 // Step size for smoother swipe
    });
  }

  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    this.ensureConnected();

    await this.callTool('ui_swipe', {
      udid: this.deviceUdid,
      x_start: startX,
      y_start: startY,
      x_end: endX,
      y_end: endY,
      duration: '0.3',
      delta: 10
    });
  }

  async pressButton(button: 'home' | 'back'): Promise<void> {
    this.ensureConnected();
    // ios-simulator-mcp doesn't support button presses
    throw new UnsupportedOperationError(
      'pressButton',
      'ios-simulator-mcp',
      'Button presses not supported. Use DeviceManager for home button.'
    );
  }

  // ── App Lifecycle ──────────────────────────────────────────────

  async launchApp(bundleId: string): Promise<void> {
    this.ensureConnected();

    await this.callTool('launch_app', {
      udid: this.deviceUdid,
      bundle_id: bundleId,
      terminate_running: false
    });
  }

  async terminateApp(bundleId: string): Promise<void> {
    this.ensureConnected();

    // ios-simulator-mcp's launch_app has terminate_running option
    // but there's no explicit terminate. Use DeviceManager as fallback.
    throw new UnsupportedOperationError(
      'terminateApp',
      'ios-simulator-mcp',
      'Use DeviceManager.terminate() instead.'
    );
  }

  async installApp(appPath: string): Promise<void> {
    this.ensureConnected();

    await this.callTool('install_app', {
      udid: this.deviceUdid,
      app_path: appPath
    });
  }

  async uninstallApp(bundleId: string): Promise<void> {
    throw new UnsupportedOperationError(
      'uninstallApp',
      'ios-simulator-mcp',
      'Use DeviceManager.uninstall() instead.'
    );
  }

  // ── Debug & Utilities ──────────────────────────────────────────

  async listCapabilities(): Promise<Array<{ name: string; description?: string }>> {
    this.ensureConnected();

    const result = await this.client!.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  getProviderInfo(): {
    name: string;
    version: string;
    supportsElementTap: boolean;
    supportsCoordinateTap: boolean;
    supportsAppLifecycle: boolean;
  } {
    return {
      name: 'ios-simulator-mcp',
      version: '1.0.0',
      supportsElementTap: false,
      supportsCoordinateTap: true,
      supportsAppLifecycle: true, // install_app, launch_app supported!
    };
  }

  // ── Private Helpers ────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('ios-simulator-mcp client is not connected. Call connect() first.');
    }
  }

  /**
   * Call an MCP tool with retry logic
   */
  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.client!.callTool({ name, arguments: args }, undefined);

        if (result.isError) {
          // Format error content properly
          let errorMessage = 'Unknown error';

          if (Array.isArray(result.content)) {
            errorMessage = result.content.map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                if ('text' in item) return item.text;
                return JSON.stringify(item, null, 2);
              }
              return String(item);
            }).join('\n');
          } else if (typeof result.content === 'string') {
            errorMessage = result.content;
          } else if (result.content && typeof result.content === 'object') {
            errorMessage = JSON.stringify(result.content, null, 2);
          }

          throw new Error(`MCP tool '${name}' error: ${errorMessage}`);
        }

        // Extract content from result
        if (Array.isArray(result.content) && result.content.length > 0) {
          const firstContent = result.content[0];

          // Handle text content
          if ('text' in firstContent) {
            try {
              return JSON.parse(firstContent.text);
            } catch {
              return firstContent.text;
            }
          }
        }

        return result.content;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          throw new Error(`MCP call '${name}' failed after ${maxRetries} attempts: ${errorMsg}`);
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`MCP call '${name}' failed: max retries exceeded`);
  }

  /**
   * Parse accessibility tree from ios-simulator-mcp response
   *
   * The format differs from mobile-mcp - need to adapt to the
   * ui_describe_all response format which returns accessibility
   * information as structured text or JSON
   */
  private parseAccessibilityTree(data: unknown): AccessibilityNode {
    // ios-simulator-mcp returns accessibility info as text/JSON
    // The exact format may vary - handle both structured and text responses

    if (typeof data === 'string') {
      // Parse text description into tree structure
      // For now, create a simple root node with the description
      return {
        role: 'Window',
        label: 'Screen',
        id: 'root',
        traits: [],
        frame: { x: 0, y: 0, width: 430, height: 932 },
        children: [{
          role: 'Description',
          label: data,
          id: 'accessibility-text',
          traits: [],
          frame: { x: 0, y: 0, width: 430, height: 932 },
          children: []
        }]
      };
    }

    if (typeof data === 'object' && data !== null) {
      // If it's already structured, try to convert it
      // The exact structure depends on the MCP server's response format
      const obj = data as any;

      // Check if it has elements array (similar to mobile-mcp)
      if (Array.isArray(obj.elements)) {
        const children: AccessibilityNode[] = obj.elements.map((element: any) => ({
          role: element.type || element.role || 'Unknown',
          label: element.label || element.name || '',
          value: element.value || '',
          id: element.id || element.identifier || `element-${Math.random()}`,
          traits: element.traits || [],
          frame: element.frame || element.rect || { x: 0, y: 0, width: 0, height: 0 },
          children: []
        }));

        return {
          role: 'Window',
          label: 'Screen',
          id: 'root',
          traits: [],
          frame: { x: 0, y: 0, width: 430, height: 932 },
          children
        };
      }

      // If it's a single element, wrap it
      return {
        role: 'Window',
        label: 'Screen',
        id: 'root',
        traits: [],
        frame: { x: 0, y: 0, width: 430, height: 932 },
        children: [{
          role: obj.type || obj.role || 'Element',
          label: obj.label || obj.name || JSON.stringify(obj),
          value: obj.value || '',
          id: obj.id || 'element-0',
          traits: obj.traits || [],
          frame: obj.frame || obj.rect || { x: 0, y: 0, width: 0, height: 0 },
          children: []
        }]
      };
    }

    // Fallback: create empty tree
    console.warn('[ios-simulator-mcp] Unexpected accessibility tree format:', typeof data);
    return {
      role: 'Window',
      label: 'Screen',
      id: 'root',
      traits: [],
      frame: { x: 0, y: 0, width: 430, height: 932 },
      children: []
    };
  }
}
