import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import type {
  Recording,
  Step,
  ActionType,
  ElementSelector,
  ScreenshotPoint,
} from '../types/recording.js';
import type { SimulatorDevice } from '../types/device.js';
import { WDAConnection } from './wda-connection.js';
import { generateId, hashObject } from '../utils/hash.js';
import { logger } from '../utils/logger.js';

/**
 * Recording session state
 */
export interface RecordingSession {
  id: string;
  name: string;
  device: SimulatorDevice;
  bundleId: string;
  steps: Step[];
  screenshotPoints: ScreenshotPoint[];
  startTime: number;
  isActive: boolean;
}

/**
 * Recorder events
 */
export interface RecorderEvents {
  step: (step: Step) => void;
  screenshot: (point: ScreenshotPoint) => void;
  stopped: (recording: Recording) => void;
  error: (error: Error) => void;
}

/**
 * Recorder for capturing user walkthroughs (US-003, US-004)
 */
export class Recorder extends EventEmitter {
  private session: RecordingSession | null = null;
  private wda: WDAConnection | null = null;
  private recordingsDir: string;

  constructor(recordingsDir = './recordings') {
    super();
    this.recordingsDir = recordingsDir;
  }

  /**
   * Start a new recording session
   */
  async startSession(
    name: string,
    device: SimulatorDevice,
    bundleId: string,
    wda: WDAConnection
  ): Promise<RecordingSession> {
    if (this.session?.isActive) {
      throw new Error('Recording session already active');
    }

    logger.info({ name, device: device.name, bundleId }, 'Starting recording session');

    this.wda = wda;
    this.session = {
      id: generateId('rec'),
      name,
      device,
      bundleId,
      steps: [],
      screenshotPoints: [],
      startTime: Date.now(),
      isActive: true,
    };

    return this.session;
  }

  /**
   * Record a step manually (for direct action capture)
   */
  async recordStep(
    action: ActionType,
    selector: ElementSelector,
    value?: string,
    description?: string
  ): Promise<Step> {
    if (!this.session?.isActive) {
      throw new Error('No active recording session');
    }

    if (!this.wda) {
      throw new Error('WebDriverAgent not connected');
    }

    // Capture accessibility tree
    const accessibilityTree = await this.wda.getAccessibilityTree();

    const step: Step = {
      index: this.session.steps.length,
      action,
      selector,
      value,
      accessibilityTree,
      timestamp: Date.now() - this.session.startTime,
      description,
    };

    this.session.steps.push(step);
    this.emit('step', step);

    logger.debug(
      { index: step.index, action: step.action },
      'Recorded step'
    );

    return step;
  }

  /**
   * Record a tap action
   */
  async recordTap(
    selector: ElementSelector,
    description?: string
  ): Promise<Step> {
    return this.recordStep('tap', selector, undefined, description);
  }

  /**
   * Record a type action
   */
  async recordType(
    selector: ElementSelector,
    value: string,
    description?: string
  ): Promise<Step> {
    return this.recordStep('type', selector, value, description);
  }

  /**
   * Record a swipe action
   */
  async recordSwipe(
    selector: ElementSelector,
    description?: string
  ): Promise<Step> {
    return this.recordStep('swipe', selector, undefined, description);
  }

  /**
   * Record a scroll action
   */
  async recordScroll(
    selector: ElementSelector,
    description?: string
  ): Promise<Step> {
    return this.recordStep('scroll', selector, undefined, description);
  }

  /**
   * Mark a screenshot point (US-004)
   */
  async markScreenshot(label: string, description?: string): Promise<ScreenshotPoint> {
    if (!this.session?.isActive) {
      throw new Error('No active recording session');
    }

    if (!this.wda) {
      throw new Error('WebDriverAgent not connected');
    }

    // Capture current accessibility tree for verification
    const accessibilityTree = await this.wda.getAccessibilityTree();

    const point: ScreenshotPoint = {
      afterStep: this.session.steps.length - 1,
      label,
      accessibilityTreeHash: hashObject(accessibilityTree),
      description,
    };

    this.session.screenshotPoints.push(point);
    this.emit('screenshot', point);

    logger.info(
      { label, afterStep: point.afterStep },
      'Marked screenshot point'
    );

    return point;
  }

  /**
   * Stop recording and save
   */
  async stopSession(): Promise<Recording> {
    if (!this.session?.isActive) {
      throw new Error('No active recording session');
    }

    if (this.session.screenshotPoints.length === 0) {
      throw new Error('At least one screenshot point is required');
    }

    logger.info({ name: this.session.name }, 'Stopping recording session');

    this.session.isActive = false;

    const recording: Recording = {
      id: this.session.id,
      name: this.session.name,
      bundleId: this.session.bundleId,
      steps: this.session.steps,
      screenshotPoints: this.session.screenshotPoints,
      createdAt: new Date().toISOString(),
      device: {
        udid: this.session.device.udid,
        name: this.session.device.name,
        version: this.session.device.version,
      },
    };

    // Save to file
    await this.saveRecording(recording);

    this.emit('stopped', recording);
    this.session = null;

    return recording;
  }

  /**
   * Save recording to file
   */
  private async saveRecording(recording: Recording): Promise<void> {
    // Ensure recordings directory exists
    await fs.mkdir(this.recordingsDir, { recursive: true });

    const filename = `${recording.name}.json`;
    const filepath = path.join(this.recordingsDir, filename);

    const content = JSON.stringify(recording, null, 2);
    await fs.writeFile(filepath, content, 'utf-8');

    logger.info({ filepath }, 'Recording saved');
  }

  /**
   * Load recording from file
   */
  async loadRecording(name: string): Promise<Recording> {
    const filename = name.endsWith('.json') ? name : `${name}.json`;
    const filepath = path.join(this.recordingsDir, filename);

    const content = await fs.readFile(filepath, 'utf-8');
    const recording: Recording = JSON.parse(content);

    logger.info({ name, filepath }, 'Recording loaded');
    return recording;
  }

  /**
   * List all recordings
   */
  async listRecordings(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.recordingsDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.basename(f, '.json'));
    } catch {
      return [];
    }
  }

  /**
   * Get current session
   */
  getSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Cancel current session without saving
   */
  cancelSession(): void {
    if (this.session) {
      logger.warn({ name: this.session.name }, 'Recording session cancelled');
      this.session.isActive = false;
      this.session = null;
    }
  }
}
