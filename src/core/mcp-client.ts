import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AccessibilityNode, ScreenInfo } from '../types/index.js';

// ── MCPClient Class ────────────────────────────────────────────

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

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

    const result = await this.callTool('get_accessibility_tree', {});
    return this.parseAccessibilityTree(result);
  }

  /**
   * Tap an element by its ID
   */
  async tap(elementId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('tap', { element_id: elementId });
  }

  /**
   * Tap at specific coordinates
   */
  async tapCoordinates(x: number, y: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('tap', { x, y });
  }

  /**
   * Type text into the focused field
   */
  async type(text: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('type', { text });
  }

  /**
   * Scroll in a direction
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('scroll', { direction, amount });
  }

  /**
   * Swipe gesture
   */
  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    this.ensureConnected();
    await this.callTool('swipe', { startX, startY, endX, endY });
  }

  /**
   * Press a button (home, back, etc.)
   */
  async pressButton(button: 'home' | 'back'): Promise<void> {
    this.ensureConnected();
    await this.callTool('press_button', { button });
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(): Promise<Buffer> {
    this.ensureConnected();

    const result = await this.callTool('take_screenshot', {});

    // Result should be base64-encoded PNG
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }

    if (result && typeof result === 'object' && 'data' in result) {
      return Buffer.from((result as { data: string }).data, 'base64');
    }

    throw new Error('Invalid screenshot response from MCP server');
  }

  /**
   * Get screen information (dimensions, scale, orientation)
   */
  async getScreenInfo(): Promise<ScreenInfo> {
    this.ensureConnected();

    const result = await this.callTool('get_screen_info', {});
    return result as ScreenInfo;
  }

  /**
   * Install an app
   */
  async installApp(appPath: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('install_app', { path: appPath });
  }

  /**
   * Launch an app by bundle ID
   */
  async launchApp(bundleId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('launch_app', { bundle_id: bundleId });
  }

  /**
   * Terminate an app by bundle ID
   */
  async terminateApp(bundleId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('terminate_app', { bundle_id: bundleId });
  }

  /**
   * Uninstall an app by bundle ID
   */
  async uninstallApp(bundleId: string): Promise<void> {
    this.ensureConnected();
    await this.callTool('uninstall_app', { bundle_id: bundleId });
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
