/**
 * Mobile Automation Provider Abstraction Layer
 *
 * This module provides a common interface for different mobile automation
 * backends (MCP servers, Appium, Maestro, etc.), allowing them to be used
 * interchangeably via the Adapter pattern.
 */

// Core interfaces
export type {
  IMobileAutomationProvider,
  ProviderConfig,
} from './mobile-automation-provider.js';

export { UnsupportedOperationError } from './mobile-automation-provider.js';

// Provider implementations
export { MobileMCPProvider } from './mobile-mcp-provider.js';

// Factory
export {
  ProviderFactory,
  parseProviderType,
  createProviderFromEndpoint,
} from './provider-factory.js';
