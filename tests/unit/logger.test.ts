import { describe, it, expect } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  it('should be a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should have child logger capability', () => {
    const child = logger.child({ module: 'test' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('should handle structured logging', () => {
    // This just verifies the logger accepts structured data without errors
    expect(() => {
      logger.info({ test: 'data' }, 'Test message');
    }).not.toThrow();
  });
});
