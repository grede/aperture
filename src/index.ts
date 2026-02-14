// Main library exports for programmatic usage

export { FlowParser } from './core/flow-parser.js';
export { DeviceManager } from './core/device-manager.js';
export { MCPClient } from './core/mcp-client.js';
export { AINavigator } from './core/ai-navigator.js';
export { CostTracker } from './core/cost-tracker.js';

export type {
  FlowDefinition,
  FlowStep,
  ValidationResult,
  AccessibilityNode,
  ScreenInfo,
  NavigationResult,
  ActionRecord,
  Guardrails,
  SimulatorDevice,
  LocaleData,
  TemplateStyle,
  CompositeOptions,
  CostSummary,
  ApertureConfig,
  LLMAction,
  LLMVerification,
} from './types/index.js';
