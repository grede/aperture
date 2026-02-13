/**
 * Complete recording of a user walkthrough
 */
export interface Recording {
  /** Unique recording ID */
  id: string;
  /** User-provided name */
  name: string;
  /** App bundle identifier */
  bundleId: string;
  /** Sequence of recorded actions */
  steps: Step[];
  /** Marked screenshot capture points */
  screenshotPoints: ScreenshotPoint[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** Device used for recording */
  device?: {
    udid: string;
    name: string;
    version: string;
  };
}

/**
 * Individual action step in a recording
 */
export interface Step {
  /** Step index (0-based) */
  index: number;
  /** Action type */
  action: ActionType;
  /** Element selector used to locate target */
  selector: ElementSelector;
  /** Value for type actions */
  value?: string;
  /** iOS accessibility tree snapshot at step time */
  accessibilityTree: string;
  /** Timestamp relative to recording start (ms) */
  timestamp: number;
  /** Optional description */
  description?: string;
  /** Optional verification checkpoint (US-013) */
  checkpoint?: StepCheckpoint;
}

/**
 * Step verification checkpoint (US-013)
 */
export interface StepCheckpoint {
  /** Elements that must be present in accessibility tree */
  requiredElements?: string[];
  /** Elements that must NOT be present in accessibility tree */
  forbiddenElements?: string[];
  /** Expected screen/view controller name */
  expectedScreen?: string;
}

/**
 * Supported action types
 */
export type ActionType = 'tap' | 'type' | 'scroll' | 'swipe' | 'back' | 'home' | 'wait';

/**
 * Element selector with priority cascade
 */
export interface ElementSelector {
  /** Most stable: accessibility identifier */
  accessibilityIdentifier?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Visible label text */
  label?: string;
  /** Element type (e.g., "XCUIElementTypeButton") */
  elementType?: string;
  /** XPath selector (last resort) */
  xpath?: string;
  /** Element bounds [x, y, width, height] */
  bounds?: [number, number, number, number];
  /** Additional attributes for matching */
  attributes?: Record<string, string>;
}

/**
 * Screenshot capture point marker
 */
export interface ScreenshotPoint {
  /** Step index after which to capture */
  afterStep: number;
  /** User-provided label for this screenshot */
  label: string;
  /** Hash of accessibility tree state at this point */
  accessibilityTreeHash: string;
  /** Optional description for marketing copy */
  description?: string;
}

/**
 * Scroll action details
 */
export interface ScrollAction {
  /** Scroll direction */
  direction: 'up' | 'down' | 'left' | 'right';
  /** Distance in points (optional) */
  distance?: number;
  /** Element to scroll (if not full screen) */
  element?: ElementSelector;
}

/**
 * Swipe action details
 */
export interface SwipeAction {
  /** Swipe direction */
  direction: 'up' | 'down' | 'left' | 'right';
  /** Start coordinates (optional) */
  start?: [number, number];
  /** End coordinates (optional) */
  end?: [number, number];
}
