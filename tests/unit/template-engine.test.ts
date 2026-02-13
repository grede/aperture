import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../../src/templates/template-engine.js';
import type { TemplateStyleName } from '../../src/types/export.js';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('listStyles', () => {
    it('should list all available template styles', async () => {
      const styles = await engine.listStyles();

      expect(styles).toContain('minimal');
      expect(styles).toContain('modern');
      expect(styles).toContain('gradient');
      expect(styles).toContain('dark');
      expect(styles).toContain('playful');
      expect(styles).toHaveLength(5);
    });
  });

  describe('loadStyle', () => {
    it('should load a valid template style', async () => {
      const style = await engine.loadStyle('modern');

      expect(style.name).toBe('modern');
      expect(style.displayName).toBe('Modern');
      expect(style.background).toBeDefined();
      expect(style.deviceFrame).toBeDefined();
      expect(style.textOverlays).toBeDefined();
      expect(style.safeArea).toBeDefined();
    });

    it('should cache loaded styles', async () => {
      const style1 = await engine.loadStyle('minimal');
      const style2 = await engine.loadStyle('minimal');

      // Both should reference the same cached object
      expect(style1).toBe(style2);
    });

    it('should load different styles independently', async () => {
      const minimal = await engine.loadStyle('minimal');
      const modern = await engine.loadStyle('modern');

      expect(minimal.name).toBe('minimal');
      expect(modern.name).toBe('modern');
      expect(minimal.background.type).toBe('solid');
      expect(modern.background.type).toBe('gradient');
    });
  });

  describe('style definitions', () => {
    const styleNames: TemplateStyleName[] = ['minimal', 'modern', 'gradient', 'dark', 'playful'];

    styleNames.forEach((styleName) => {
      it(`should have valid ${styleName} style definition`, async () => {
        const style = await engine.loadStyle(styleName);

        // Validate structure
        expect(style.name).toBe(styleName);
        expect(style.displayName).toBeTruthy();
        expect(style.background).toBeDefined();
        expect(style.deviceFrame).toBeDefined();
        expect(style.textOverlays).toBeInstanceOf(Array);
        expect(style.safeArea).toBeDefined();

        // Validate background
        expect(['solid', 'gradient', 'image']).toContain(style.background.type);

        // Validate device frame
        expect(style.deviceFrame.fileName).toBeTruthy();
        expect(style.deviceFrame.displayArea.top).toBeGreaterThanOrEqual(0);
        expect(style.deviceFrame.displayArea.left).toBeGreaterThanOrEqual(0);
        expect(style.deviceFrame.displayArea.width).toBeGreaterThan(0);
        expect(style.deviceFrame.displayArea.height).toBeGreaterThan(0);

        // Validate safe area
        expect(style.safeArea.top).toBeGreaterThanOrEqual(0);
        expect(style.safeArea.bottom).toBeGreaterThanOrEqual(0);
        expect(style.safeArea.left).toBeGreaterThanOrEqual(0);
        expect(style.safeArea.right).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
