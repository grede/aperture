import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AccessibilityNode, ScreenInfo } from '../../types/index.js';
import type { IMobileAutomationProvider } from './mobile-automation-provider.js';
import { UnsupportedOperationError } from './mobile-automation-provider.js';

/**
 * Mobile automation provider implementation for @mobilenext/mobile-mcp
 *
 * This adapter wraps the MCP SDK to provide iOS automation via WebDriverAgent.
 * It supports accessibility tree inspection, coordinate-based tapping, and
 * basic device control.
 */
export class MobileMCPProvider implements IMobileAutomationProvider {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private deviceUdid: string | null = null;

  // ── Connection Management ──────────────────────────────────────

  async connect(endpoint: string): Promise<void> {
    if (this.connected) {
      return;
    }

    // Parse endpoint (format: "stdio://mobile-mcp" or custom command)
    const command = endpoint.replace('stdio://', '');

    // Create stdio transport
    this.transport = new StdioClientTransport({
      command,
      args: [],
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

    // List available devices to verify the simulator is detected
    // This is a lightweight call that doesn't require WDA
    await this.callTool('mobile_list_available_devices', { noParams: {} });

    // Make a test call to ensure WDA is ready
    // mobile-mcp will start WDA automatically on first UI interaction
    // We use increased retries here because WDA startup can take 30-60 seconds
    await this.callToolWithExtendedRetries('mobile_list_elements_on_screen', { device: udid }, 5, 10000);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── UI Inspection ──────────────────────────────────────────────

  async getAccessibilityTree(): Promise<AccessibilityNode> {
    this.ensureConnected();

    // Use the device UDID that was set during initialization
    const result = await this.callTool('mobile_list_elements_on_screen', { device: this.deviceUdid });
    return this.parseAccessibilityTree(result);
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    this.ensureConnected();

    // mobile-mcp doesn't have get_screen_info
    // Return default iPhone screen info
    return {
      width: 375,
      height: 812,
      scale: 3,
      orientation: 'portrait'
    };
  }

  async takeScreenshot(): Promise<Buffer> {
    this.ensureConnected();

    const result = await this.callTool('mobile_take_screenshot', { device: this.deviceUdid });

    // Result should be base64-encoded PNG/JPEG
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }

    if (result && typeof result === 'object') {
      // Try common field names for base64 data
      const obj = result as Record<string, unknown>;

      for (const key of ['data', 'image', 'base64', 'screenshot', 'content']) {
        if (key in obj && typeof obj[key] === 'string') {
          return Buffer.from(obj[key] as string, 'base64');
        }
      }

      // If result is a Buffer-like object
      if ('type' in obj && obj.type === 'Buffer' && 'data' in obj && Array.isArray(obj.data)) {
        return Buffer.from(obj.data as number[]);
      }
    }

    // If we get here, log what we actually received for debugging
    console.error('[Screenshot] Unexpected response format:', JSON.stringify(result, null, 2).substring(0, 500));
    throw new Error(`Invalid screenshot response from MCP server: ${typeof result}`);
  }

  // ── User Interaction ──────────────────────────────────────────

  async tap(elementId: string): Promise<void> {
    this.ensureConnected();
    // mobile-mcp doesn't support element_id tapping directly
    throw new UnsupportedOperationError(
      'tap(elementId)',
      'mobile-mcp',
      'Use tapCoordinates() with x,y from element frame.'
    );
  }

  async tapCoordinates(x: number, y: number): Promise<void> {
    this.ensureConnected();
    console.log(`[Tap] Using AppleScript to click at (${x}, ${y}) on Simulator`);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // AppleScript to click the Simulator window at the specified coordinates
    // The Simulator window title contains the device name
    const script = `
      tell application "System Events"
        tell process "Simulator"
          set frontmost to true
          click at {${x}, ${y}}
        end tell
      end tell
    `;

    try {
      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      console.log(`[Tap] Success`);

      // Give the app time to respond
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`AppleScript tap failed at (${x}, ${y}): ${errorMsg}`);
    }
  }

  async type(text: string): Promise<void> {
    this.ensureConnected();
    // mobile-mcp requires a 'submit' parameter (boolean) for mobile_type_keys
    await this.callTool('mobile_type_keys', { device: this.deviceUdid, text, submit: false });
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void> {
    this.ensureConnected();

    // Convert scroll to swipe coordinates
    // Assume screen size of 375x812 (iPhone standard) - could be improved to get actual screen size
    const screenWidth = 375;
    const screenHeight = 812;
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    const scrollDistance = amount ?? 200;

    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case 'up':
        startY = centerY + scrollDistance;
        endY = centerY - scrollDistance;
        break;
      case 'down':
        startY = centerY - scrollDistance;
        endY = centerY + scrollDistance;
        break;
      case 'left':
        startX = centerX + scrollDistance;
        endX = centerX - scrollDistance;
        break;
      case 'right':
        startX = centerX - scrollDistance;
        endX = centerX + scrollDistance;
        break;
    }

    await this.callTool('mobile_swipe_on_screen', {
      device: this.deviceUdid,
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    });
  }

  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_swipe_on_screen', {
      device: this.deviceUdid,
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    });
  }

  async pressButton(button: 'home' | 'back'): Promise<void> {
    this.ensureConnected();
    // mobile-mcp doesn't support press_button reliably
    throw new UnsupportedOperationError(
      'pressButton',
      'mobile-mcp',
      'Button presses not supported.'
    );
  }

  // ── App Lifecycle ──────────────────────────────────────────────

  async launchApp(bundleId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_open_app', { package: bundleId });
  }

  async terminateApp(bundleId: string): Promise<void> {
    throw new UnsupportedOperationError(
      'terminateApp',
      'mobile-mcp',
      'Use DeviceManager.terminate() instead.'
    );
  }

  async installApp(appPath: string): Promise<void> {
    throw new UnsupportedOperationError(
      'installApp',
      'mobile-mcp',
      'Use DeviceManager.install() instead.'
    );
  }

  async uninstallApp(bundleId: string): Promise<void> {
    throw new UnsupportedOperationError(
      'uninstallApp',
      'mobile-mcp',
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
      name: '@mobilenext/mobile-mcp',
      version: '1.0.0',
      supportsElementTap: false,
      supportsCoordinateTap: true,
      supportsAppLifecycle: false,
    };
  }

  // ── Private Helpers ────────────────────────────────────────────

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('MCP client is not connected. Call connect() first.');
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

          // Handle image content (screenshots)
          if ('type' in firstContent && firstContent.type === 'image') {
            if ('data' in firstContent && typeof firstContent.data === 'string') {
              return firstContent.data; // Return base64 string directly
            }
          }

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
          // Format the final error message with better detail
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
   * Call an MCP tool with extended retry logic for WDA startup
   */
  private async callToolWithExtendedRetries(
    name: string,
    args: Record<string, unknown>,
    maxRetries = 5,
    baseDelay = 10000
  ): Promise<unknown> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.client!.callTool({ name, arguments: args }, undefined);

        if (result.isError) {
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
          }

          // If it's a WDA timeout, retry with longer delay
          if (errorMessage.includes('timed out waiting for WebDriverAgent')) {
            if (attempt < maxRetries - 1) {
              const delay = baseDelay * (attempt + 1);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }

          throw new Error(`MCP tool '${name}' error: ${errorMessage}`);
        }

        // Extract content from result
        if (Array.isArray(result.content) && result.content.length > 0) {
          const firstContent = result.content[0];

          // Handle image content (screenshots)
          if ('type' in firstContent && firstContent.type === 'image') {
            if ('data' in firstContent && typeof firstContent.data === 'string') {
              return firstContent.data; // Return base64 string directly
            }
          }

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

        // Longer delay for WDA startup retries
        const delay = baseDelay * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`MCP call '${name}' failed: max retries exceeded`);
  }

  /**
   * Parse accessibility tree from MCP response
   * @mobilenext/mobile-mcp returns an array of elements, convert to tree
   */
  private parseAccessibilityTree(data: unknown): AccessibilityNode {
    // Handle string responses from mobile-mcp (it includes debug text)
    let elements: any[];

    if (typeof data === 'string') {
      // Extract JSON array from text like "=> Found these elements on screen: [{...}]"
      const jsonMatch = data.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON array from response');
      }
      try {
        elements = JSON.parse(jsonMatch[0]);
      } catch (error) {
        throw new Error(`Failed to parse accessibility tree JSON: ${error}`);
      }
    } else if (Array.isArray(data)) {
      elements = data;
    } else {
      throw new Error(`Invalid accessibility tree data: expected array or string, got ${typeof data}`);
    }

    // Convert array format to tree format
    const children: AccessibilityNode[] = elements.map((element: any) => ({
      role: element.type || element.label || 'Unknown',
      label: element.label || element.name || '',
      value: element.value || '',
      id: element.identifier || `${element.coordinates?.x || 0}-${element.coordinates?.y || 0}`,
      traits: [],
      frame: element.coordinates ? {
        x: element.coordinates.x,
        y: element.coordinates.y,
        width: element.coordinates.width,
        height: element.coordinates.height
      } : { x: 0, y: 0, width: 0, height: 0 },
      children: []
    }));

    // Create root node
    return {
      role: 'Window',
      label: 'Screen',
      id: 'root',
      traits: [],
      frame: { x: 0, y: 0, width: 0, height: 0 },
      children
    };
  }
}
