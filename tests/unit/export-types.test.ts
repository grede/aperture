import { describe, it, expect } from 'vitest';
import { EXPORT_SIZES } from '../../src/types/export.js';

describe('Export Types', () => {
  describe('EXPORT_SIZES', () => {
    it('should define iPhone 6.5" dimensions correctly', () => {
      const iphone = EXPORT_SIZES.iphone;

      expect(iphone.device).toBe('iphone');
      expect(iphone.displayName).toBe('iPhone 6.5"');
      expect(iphone.width).toBe(1242);
      expect(iphone.height).toBe(2688);
    });

    it('should define iPad 13" dimensions correctly', () => {
      const ipad = EXPORT_SIZES.ipad;

      expect(ipad.device).toBe('ipad');
      expect(ipad.displayName).toBe('iPad 13"');
      expect(ipad.width).toBe(2048);
      expect(ipad.height).toBe(2732);
    });

    it('should have portrait orientation for both devices', () => {
      // App Store screenshots are typically portrait
      expect(EXPORT_SIZES.iphone.height).toBeGreaterThan(EXPORT_SIZES.iphone.width);
      expect(EXPORT_SIZES.ipad.height).toBeGreaterThan(EXPORT_SIZES.ipad.width);
    });

    it('should have valid aspect ratios', () => {
      const iphoneRatio = EXPORT_SIZES.iphone.height / EXPORT_SIZES.iphone.width;
      const ipadRatio = EXPORT_SIZES.ipad.height / EXPORT_SIZES.ipad.width;

      // iPhone 6.5" aspect ratio ~2.16:1
      expect(iphoneRatio).toBeCloseTo(2.16, 1);

      // iPad 13" aspect ratio ~1.33:1 (4:3)
      expect(ipadRatio).toBeCloseTo(1.33, 1);
    });
  });
});
