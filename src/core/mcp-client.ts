import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AccessibilityNode, ScreenInfo } from '../types/index.js';

// ── MCPClient Class ────────────────────────────────────────────

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private deviceUdid: string | null = null;

  /**
   * Connect to the MCP server
   */
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

  /**
   * Initialize mobile device for iOS simulator
   */
  async initializeDevice(udid: string): Promise<void> {
    this.ensureConnected();
    this.deviceUdid = udid;

    // Initialize mobile-mcp for iOS simulator with WebDriverAgent
    await this.callTool('mobile_init', {
      platform: 'ios',
      device_id: udid,
      udid: udid,
      wda_url: 'http://localhost:8100'
    });
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    this.ensureConnected();

    const result = await this.client!.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client?.close();
    this.connected = false;
    this.client = null;
    this.transport = null;
  }

  /**
   * Get the accessibility tree of the current screen
   */
  async getAccessibilityTree(): Promise<AccessibilityNode> {
    this.ensureConnected();

    const result = await this.callTool('mobile_dump_ui', {});
    return this.parseAccessibilityTree(result);
  }

  /**
   * Tap an element by its ID
   * Note: mobile-mcp only supports coordinate-based tapping,
   * so this method would need to extract coordinates from the element
   */
  async tap(elementId: string): Promise<void> {
    this.ensureConnected();
    // mobile-mcp doesn't support element_id tapping directly
    // The AI should provide coordinates instead
    throw new Error('Element ID tapping not supported by mobile-mcp. Use tapCoordinates() with x,y from element frame.');
  }

  /**
   * Tap at specific coordinates
   */
  async tapCoordinates(x: number, y: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_tap', { x, y });
  }

  /**
   * Type text into the focused field
   */
  async type(text: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_type', { text });
  }

  /**
   * Scroll in a direction
   * Note: mobile-mcp uses swipe for scrolling
   */
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

    await this.callTool('mobile_swipe', {
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    });
  }

  /**
   * Swipe gesture
   */
  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_swipe', {
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    });
  }

  /**
   * Press a button (home, back, etc.)
   */
  async pressButton(button: 'home' | 'back'): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_key_press', { key: button });
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(): Promise<Buffer> {
    this.ensureConnected();

    const result = await this.callTool('mobile_screenshot', {});

    // Result should be base64-encoded PNG
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }

    if (result && typeof result === 'object' && 'data' in result) {
      return Buffer.from((result as { data: string }).data, 'base64');
    }

    if (result && typeof result === 'object' && 'image' in result) {
      return Buffer.from((result as { image: string }).image, 'base64');
    }

    throw new Error('Invalid screenshot response from MCP server');
  }

  /**
   * Get screen information (dimensions, scale, orientation)
   * Note: mobile-mcp doesn't provide this, so we return default values
   */
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

  /**
   * Install an app
   * Note: Not supported by mobile-mcp, use DeviceManager instead
   */
  async installApp(appPath: string): Promise<void> {
    throw new Error('installApp not supported by mobile-mcp. Use DeviceManager.install() instead.');
  }

  /**
   * Launch an app by bundle ID
   * Note: mobile-mcp uses mobile_open_app with package name
   */
  async launchApp(bundleId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('mobile_open_app', { package: bundleId });
  }

  /**
   * Terminate an app by bundle ID
   * Note: Not supported by mobile-mcp, use DeviceManager instead
   */
  async terminateApp(bundleId: string): Promise<void> {
    throw new Error('terminateApp not supported by mobile-mcp. Use DeviceManager.terminate() instead.');
  }

  /**
   * Uninstall an app by bundle ID
   * Note: Not supported by mobile-mcp, use DeviceManager instead
   */
  async uninstallApp(bundleId: string): Promise<void> {
    throw new Error('uninstallApp not supported by mobile-mcp. Use DeviceManager.uninstall() instead.');
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
   * Parse accessibility tree from MCP response
   */
  private parseAccessibilityTree(data: unknown): AccessibilityNode {
    // The MCP server should return a structured accessibility tree
    // This is a simplified parser - adjust based on actual mobile-mcp format
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid accessibility tree data');
    }

    return data as AccessibilityNode;
  }

  /**
   * Ensure client is connected before making calls
   */
  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('MCP client is not connected. Call connect() first.');
    }
  }
}
