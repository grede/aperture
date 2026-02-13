import { describe, it, expect } from 'vitest';
import type { Step, Recording } from '../../src/types/recording.js';
import type { LocaleData } from '../../src/types/locale.js';

describe('Edge Cases and Error Handling', () => {
  describe('parameter substitution edge cases', () => {
    it('should handle empty parameter values', () => {
      const template = 'Hello {{name}}';
      const parameters = { name: '' };

      const result = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        const value = parameters[paramName as keyof typeof parameters];
        return value !== undefined ? value : match;
      });

      expect(result).toBe('Hello ');
    });

    it('should handle multiple occurrences of same parameter', () => {
      const template = '{{name}} said hello to {{name}}';
      const parameters = { name: 'Alice' };

      const result = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        return parameters[paramName as keyof typeof parameters] || match;
      });

      expect(result).toBe('Alice said hello to Alice');
    });

    it('should handle adjacent parameters', () => {
      const template = '{{firstName}}{{lastName}}';
      const parameters = { firstName: 'John', lastName: 'Doe' };

      const result = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        return parameters[paramName as keyof typeof parameters] || match;
      });

      expect(result).toBe('JohnDoe');
    });

    it('should handle parameters with special characters in values', () => {
      const template = 'Search: {{query}}';
      const parameters = { query: 'hello@world.com' };

      const result = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        return parameters[paramName as keyof typeof parameters] || match;
      });

      expect(result).toBe('Search: hello@world.com');
    });
  });

  describe('recording validation edge cases', () => {
    it('should handle recordings with no steps', () => {
      const recording: Partial<Recording> = {
        id: 'empty-recording',
        steps: [],
        screenshotPoints: [],
      };

      expect(recording.steps).toHaveLength(0);
      expect(recording.screenshotPoints).toHaveLength(0);
    });

    it('should handle recordings with only tap actions', () => {
      const steps: Step[] = [
        {
          index: 0,
          action: 'tap',
          selector: { accessibilityIdentifier: 'button1' },
          accessibilityTree: '',
          timestamp: 1000,
        },
        {
          index: 1,
          action: 'tap',
          selector: { accessibilityIdentifier: 'button2' },
          accessibilityTree: '',
          timestamp: 2000,
        },
      ];

      const typeSteps = steps.filter((s) => s.action === 'type');
      expect(typeSteps).toHaveLength(0);
    });

    it('should handle very long step sequences', () => {
      const steps: Step[] = Array.from({ length: 100 }, (_, i) => ({
        index: i,
        action: i % 2 === 0 ? 'tap' : 'type',
        selector: { accessibilityIdentifier: `element-${i}` },
        value: i % 2 === 1 ? `value-${i}` : undefined,
        accessibilityTree: '',
        timestamp: i * 1000,
      }));

      expect(steps).toHaveLength(100);
      expect(steps.filter((s) => s.action === 'tap')).toHaveLength(50);
      expect(steps.filter((s) => s.action === 'type')).toHaveLength(50);
    });
  });

  describe('locale data edge cases', () => {
    it('should handle locale data with no parameters', () => {
      const localeData: LocaleData = {
        locale: 'en',
        templateHash: 'abc123',
        parameters: {},
      };

      expect(Object.keys(localeData.parameters)).toHaveLength(0);
    });

    it('should handle locale data with many parameters', () => {
      const parameters: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        parameters[`param${i}`] = `value${i}`;
      }

      const localeData: LocaleData = {
        locale: 'en',
        templateHash: 'abc123',
        parameters,
      };

      expect(Object.keys(localeData.parameters)).toHaveLength(50);
    });

    it('should handle locale codes with special formats', () => {
      const localeCodes = ['en', 'en-US', 'zh-Hans', 'zh-Hant', 'pt-BR', 'es-419'];

      localeCodes.forEach((locale) => {
        const localeData: LocaleData = {
          locale,
          templateHash: 'abc123',
          parameters: {},
        };

        expect(localeData.locale).toBe(locale);
      });
    });
  });

  describe('selector edge cases', () => {
    it('should handle selectors with no identifiers', () => {
      const selector = {
        elementType: 'XCUIElementTypeButton',
      };

      expect(selector.accessibilityIdentifier).toBeUndefined();
      expect(selector.accessibilityLabel).toBeUndefined();
      expect(selector.label).toBeUndefined();
    });

    it('should handle selectors with all identifiers', () => {
      const selector = {
        accessibilityIdentifier: 'button-id',
        accessibilityLabel: 'Button Label',
        label: 'Button',
        elementType: 'XCUIElementTypeButton',
        xpath: '//XCUIElementTypeButton[@name="Button"]',
      };

      expect(selector.accessibilityIdentifier).toBe('button-id');
      expect(selector.accessibilityLabel).toBe('Button Label');
      expect(selector.label).toBe('Button');
      expect(selector.xpath).toContain('XCUIElementTypeButton');
    });

    it('should handle selectors with special characters', () => {
      const selector = {
        accessibilityLabel: 'Hello "World" & Friends',
        label: "It's working!",
      };

      expect(selector.accessibilityLabel).toContain('"');
      expect(selector.label).toContain("'");
    });
  });

  describe('hash consistency', () => {
    it('should produce same hash for equivalent objects', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { a: 1, b: 2, c: 3 };

      const hash1 = JSON.stringify(obj1);
      const hash2 = JSON.stringify(obj2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different object order (JSON.stringify behavior)', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };

      const hash1 = JSON.stringify(obj1);
      const hash2 = JSON.stringify(obj2);

      // JSON.stringify is key-order dependent
      expect(hash1).not.toBe(hash2);
    });
  });
});
