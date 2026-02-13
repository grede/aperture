import { describe, it, expect } from 'vitest';
import type { ApertureConfigSchema } from '../../src/config/schema.js';

describe('Config Schema', () => {
  describe('valid configuration', () => {
    it('should accept minimal valid config', () => {
      const config: ApertureConfigSchema = {
        app: {
          path: './MyApp.app',
          bundleId: 'com.example.app',
        },
        locales: ['en'],
        simulators: {
          iphone: 'test-udid',
        },
        templateStyle: 'modern',
        outputDir: './output',
        guardrails: {
          maxSteps: 50,
          stepTimeout: 10,
          runTimeout: 300,
          stepRetries: 2,
        },
      };

      expect(config).toBeDefined();
      expect(config.locales).toContain('en');
    });

    it('should accept config with iPad simulator', () => {
      const config: ApertureConfigSchema = {
        app: {
          path: './MyApp.app',
          bundleId: 'com.example.app',
        },
        locales: ['en', 'de', 'fr'],
        simulators: {
          iphone: 'iphone-udid',
          ipad: 'ipad-udid',
        },
        templateStyle: 'minimal',
        outputDir: './output',
        guardrails: {
          maxSteps: 50,
          stepTimeout: 10,
          runTimeout: 300,
          stepRetries: 2,
        },
      };

      expect(config.simulators.ipad).toBe('ipad-udid');
    });

    it('should accept config with OpenAI settings', () => {
      const config: ApertureConfigSchema = {
        app: {
          path: './MyApp.app',
          bundleId: 'com.example.app',
        },
        locales: ['en'],
        simulators: {
          iphone: 'test-udid',
        },
        templateStyle: 'gradient',
        outputDir: './output',
        guardrails: {
          maxSteps: 50,
          stepTimeout: 10,
          runTimeout: 300,
          stepRetries: 2,
        },
        openai: {
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini',
          fallbackModel: 'gpt-4o',
          maxTokens: 1000,
        },
      };

      expect(config.openai?.apiKey).toBe('sk-test-key');
      expect(config.openai?.model).toBe('gpt-4o-mini');
    });

    it('should accept all valid template styles', () => {
      const styles: Array<'minimal' | 'modern' | 'gradient' | 'dark' | 'playful'> = [
        'minimal',
        'modern',
        'gradient',
        'dark',
        'playful',
      ];

      styles.forEach((style) => {
        const config: ApertureConfigSchema = {
          app: {
            path: './MyApp.app',
            bundleId: 'com.example.app',
          },
          locales: ['en'],
          simulators: {
            iphone: 'test-udid',
          },
          templateStyle: style,
          outputDir: './output',
          guardrails: {
            maxSteps: 50,
            stepTimeout: 10,
            runTimeout: 300,
            stepRetries: 2,
          },
        };

        expect(config.templateStyle).toBe(style);
      });
    });
  });

  describe('guardrails configuration', () => {
    it('should accept custom guardrail values', () => {
      const config: ApertureConfigSchema = {
        app: {
          path: './MyApp.app',
          bundleId: 'com.example.app',
        },
        locales: ['en'],
        simulators: {
          iphone: 'test-udid',
        },
        templateStyle: 'modern',
        outputDir: './output',
        guardrails: {
          maxSteps: 100,
          stepTimeout: 20,
          runTimeout: 600,
          stepRetries: 3,
          forbiddenActions: ['delete account', 'sign out'],
        },
      };

      expect(config.guardrails.maxSteps).toBe(100);
      expect(config.guardrails.stepTimeout).toBe(20);
      expect(config.guardrails.forbiddenActions).toContain('delete account');
    });

    it('should accept guardrails without forbidden actions', () => {
      const config: ApertureConfigSchema = {
        app: {
          path: './MyApp.app',
          bundleId: 'com.example.app',
        },
        locales: ['en'],
        simulators: {
          iphone: 'test-udid',
        },
        templateStyle: 'modern',
        outputDir: './output',
        guardrails: {
          maxSteps: 50,
          stepTimeout: 10,
          runTimeout: 300,
          stepRetries: 2,
        },
      };

      expect(config.guardrails.forbiddenActions).toBeUndefined();
    });
  });
});
