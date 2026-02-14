import type { IMobileAutomationProvider, ProviderConfig } from './mobile-automation-provider.js';
import { MobileMCPProvider } from './mobile-mcp-provider.js';

/**
 * Registry of available mobile automation providers
 */
const PROVIDER_REGISTRY: Record<string, new () => IMobileAutomationProvider> = {
  'mobile-mcp': MobileMCPProvider,
  'mcp-server-mobile': MobileMCPProvider, // Alias for the same provider
  // Future providers can be added here:
  // 'appium': AppiumProvider,
  // 'maestro': MaestroProvider,
};

/**
 * Factory for creating mobile automation providers
 *
 * Usage:
 * ```typescript
 * const provider = ProviderFactory.create({
 *   type: 'mobile-mcp',
 *   endpoint: 'stdio://mcp-server-mobile'
 * });
 *
 * await provider.connect(config.endpoint);
 * await provider.initializeDevice(deviceUdid);
 * ```
 */
export class ProviderFactory {
  /**
   * Create a mobile automation provider instance
   * @param config - Provider configuration
   * @returns Provider instance (not yet connected)
   */
  static create(config: ProviderConfig): IMobileAutomationProvider {
    const ProviderClass = PROVIDER_REGISTRY[config.type];

    if (!ProviderClass) {
      const availableProviders = Object.keys(PROVIDER_REGISTRY).join(', ');
      throw new Error(
        `Unknown provider type: ${config.type}. Available providers: ${availableProviders}`
      );
    }

    return new ProviderClass();
  }

  /**
   * Register a custom provider implementation
   * @param type - Provider type identifier
   * @param providerClass - Provider class constructor
   */
  static register(type: string, providerClass: new () => IMobileAutomationProvider): void {
    PROVIDER_REGISTRY[type] = providerClass;
  }

  /**
   * Get list of registered provider types
   * @returns Array of provider type identifiers
   */
  static getAvailableProviders(): string[] {
    return Object.keys(PROVIDER_REGISTRY);
  }

  /**
   * Check if a provider type is registered
   * @param type - Provider type identifier
   */
  static isProviderAvailable(type: string): boolean {
    return type in PROVIDER_REGISTRY;
  }
}

/**
 * Parse MCP endpoint to determine provider type
 * @param endpoint - Endpoint string (e.g., "stdio://mcp-server-mobile")
 * @returns Provider type identifier
 */
export function parseProviderType(endpoint: string): string {
  // Extract command from stdio:// endpoints
  const match = endpoint.match(/^stdio:\/\/(.+)$/);
  if (match) {
    return match[1];
  }

  // Default to the endpoint as-is
  return endpoint;
}

/**
 * Create a provider from an endpoint string with auto-detection
 * @param endpoint - Endpoint string
 * @returns Connected provider instance
 */
export async function createProviderFromEndpoint(endpoint: string): Promise<IMobileAutomationProvider> {
  const type = parseProviderType(endpoint);

  const provider = ProviderFactory.create({
    type,
    endpoint,
  });

  await provider.connect(endpoint);
  return provider;
}
