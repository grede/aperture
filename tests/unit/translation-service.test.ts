import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationService } from '../../src/translations/translation-service.js';
import type { BaseScreenshotCopy } from '../../src/translations/translation-service.js';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
  });

  describe('hashBaseCopy', () => {
    it('should generate consistent hash for same input', () => {
      const baseCopy: BaseScreenshotCopy[] = [
        { label: 'screenshot-1', title: 'Welcome', subtitle: 'Get started' },
      ];

      const hash1 = TranslationService.hashBaseCopy(baseCopy);
      const hash2 = TranslationService.hashBaseCopy(baseCopy);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64-char hex string
    });

    it('should generate different hash for different input', () => {
      const baseCopy1: BaseScreenshotCopy[] = [
        { label: 'screenshot-1', title: 'Welcome' },
      ];
      const baseCopy2: BaseScreenshotCopy[] = [
        { label: 'screenshot-1', title: 'Hello' },
      ];

      const hash1 = TranslationService.hashBaseCopy(baseCopy1);
      const hash2 = TranslationService.hashBaseCopy(baseCopy2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should create system prompt with marketing adaptation instructions', () => {
      const prompt = (service as any).buildSystemPrompt();

      expect(prompt).toContain('marketing copywriter');
      expect(prompt).toContain('NOT literal translation');
      expect(prompt).toContain('cultural context');
      expect(prompt).toContain('JSON');
    });
  });

  describe('buildUserPrompt', () => {
    it('should format base copy and target locale correctly', () => {
      const baseCopy: BaseScreenshotCopy[] = [
        { label: 'chat', title: 'Chat with friends', subtitle: 'Stay connected' },
        { label: 'settings', title: 'Customize your experience' },
      ];

      const prompt = (service as any).buildUserPrompt(baseCopy, 'de');

      expect(prompt).toContain('German');
      expect(prompt).toContain('chat');
      expect(prompt).toContain('Chat with friends');
      expect(prompt).toContain('Stay connected');
      expect(prompt).toContain('settings');
      expect(prompt).toContain('Customize your experience');
    });

    it('should handle unknown locale code gracefully', () => {
      const baseCopy: BaseScreenshotCopy[] = [
        { label: 'test', title: 'Test' },
      ];

      const prompt = (service as any).buildUserPrompt(baseCopy, 'xx-YY');

      expect(prompt).toContain('xx-YY'); // Falls back to locale code
    });
  });
});
