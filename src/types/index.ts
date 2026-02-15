// ── Flow Parser Types ──────────────────────────────────────────

export interface FlowDefinition {
  app: string;
  steps: FlowStep[];
}

export type FlowStep =
  | { action: 'navigate'; instruction: string }
  | { action: 'action'; instruction: string }
  | { action: 'screenshot'; label: string }
  | { action: 'type'; text: string }
  | { action: 'wait'; duration?: number; condition?: string };

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
}

// ── MCP Client Types ───────────────────────────────────────────

export interface AccessibilityNode {
  id: string;
  role: string;
  label?: string;
  value?: string;
  traits: string[];
  frame: { x: number; y: number; width: number; height: number };
  children: AccessibilityNode[];
}

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  orientation: 'portrait' | 'landscape';
}

// ── AI Navigator Types ─────────────────────────────────────────

export interface NavigationResult {
  success: boolean;
  actionsExecuted: number;
  totalTokens: number;
  estimatedCost: number;
  actionHistory: ActionRecord[];
  error?: string;
}

export interface ActionRecord {
  timestamp: number;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  success: boolean;
}

export interface Guardrails {
  maxActionsPerStep: number;
  stepTimeoutMs: number;
  runTimeoutMs: number;
  forbiddenActions: string[];
  costCapUsd: number;
  noProgressThreshold: number; // Number of consecutive actions with no screen change before triggering vision fallback
}

// ── Device Manager Types ───────────────────────────────────────

export interface SimulatorDevice {
  udid: string;
  name: string;
  runtime: string;
  state: 'Booted' | 'Shutdown';
  deviceType: 'iPhone' | 'iPad';
}

// ── Locale Manager Types ───────────────────────────────────────

export interface LocaleData {
  [key: string]: string;
}

// ── Template Engine Types ──────────────────────────────────────

export type TemplateStyle = 'minimal' | 'modern' | 'gradient' | 'dark' | 'playful';
export type TemplateFrameMode = 'none' | 'minimal' | 'realistic';
export type TemplateDeviceType = 'iPhone' | 'iPad' | 'Android';

export interface CompositeOptions {
  screenshot: Buffer;
  style: TemplateStyle;
  deviceType: TemplateDeviceType;
  title: string;
  subtitle?: string;
  locale: string;
  frameMode?: TemplateFrameMode;
  frameAssetsDir?: string;
}

// ── Cost Tracker Types ─────────────────────────────────────────

export interface CostSummary {
  totalCost: number;
  breakdown: Array<{ model: string; calls: number; tokens: number; cost: number }>;
}

// ── Configuration Types ────────────────────────────────────────

export interface ApertureConfig {
  app?: string; // Optional: only required if installApp is true
  bundleId: string;
  installApp?: boolean; // Optional: defaults to true. Set to false to launch existing app without installing
  appDescription?: string; // Optional: brief app description for AI-generated marketing copy
  flow: string;
  locales: string[];
  devices: {
    iphone: string;
    ipad?: string; // Optional: user can skip iPad screenshots
    android?: string; // Optional: reserved for Android export workflows
  };
  template: {
    style: TemplateStyle;
    frame?: {
      mode?: TemplateFrameMode;
      assetsDir?: string;
    };
  };
  output: string;
  guardrails: {
    maxActionsPerStep: number;
    stepTimeoutSec: number;
    runTimeoutSec: number;
    costCapUsd: number;
    forbiddenActions: string[];
    noProgressThreshold?: number; // Optional: defaults to 5 if not specified
  };
  llm: {
    apiKey: string;
    defaultModel: string;
    escalationModel: string;
    escalateAfterAttempts: number;
  };
  mcp: {
    endpoint: string;
  };
}

// ── LLM Action Types ───────────────────────────────────────────

export interface LLMAction {
  type: 'tap' | 'type' | 'scroll' | 'swipe' | 'press_button' | 'wait';
  params: Record<string, unknown>;
  reasoning: string;
}

export interface LLMVerification {
  goalReached: boolean;
  reasoning: string;
}
