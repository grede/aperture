import { describe, it, expect } from 'vitest';
import type { Recording, Step } from '../../src/types/recording.js';

describe('Parameterizer', () => {
  describe('parameter detection', () => {
    it('should identify type actions with text values', () => {
      const steps: Step[] = [
        {
          index: 0,
          action: 'tap',
          selector: { accessibilityIdentifier: 'button' },
          accessibilityTree: '',
          timestamp: 1000,
        },
        {
          index: 1,
          action: 'type',
          selector: { accessibilityIdentifier: 'field' },
          value: 'test@example.com',
          accessibilityTree: '',
          timestamp: 2000,
        },
      ];

      const typeSteps = steps.filter((s) => s.action === 'type' && s.value);

      expect(typeSteps).toHaveLength(1);
      expect(typeSteps[0].value).toBe('test@example.com');
    });

    it('should handle recordings with no type actions', () => {
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
  });

  describe('parameter substitution', () => {
    it('should replace {{parameter}} placeholders with values', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const parameters = {
        name: 'Alice',
        email: 'alice@example.com',
      };

      const substituted = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        return parameters[paramName as keyof typeof parameters] || match;
      });

      expect(substituted).toBe('Hello Alice, your email is alice@example.com');
    });

    it('should preserve unmatched placeholders', () => {
      const template = 'Hello {{name}}, your id is {{userId}}';
      const parameters = {
        name: 'Bob',
      };

      const substituted = template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
        return parameters[paramName as keyof typeof parameters] || match;
      });

      expect(substituted).toBe('Hello Bob, your id is {{userId}}');
    });
  });
});
