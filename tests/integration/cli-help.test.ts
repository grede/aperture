import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

// Note: These tests require the project to be built first (npm run build)

const CLI_PATH = path.join(process.cwd(), 'dist/cli/index.js');

async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args]);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.code || 1,
    };
  }
}

describe('CLI Integration Tests', () => {
  describe('--help flag', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('aperture');
      expect(result.stdout).toContain('Usage');
      expect(result.stdout).toContain('Options');
      expect(result.stdout).toContain('Commands');
    });

    it('should list all commands', async () => {
      const result = await runCLI(['--help']);

      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('devices');
      expect(result.stdout).toContain('record');
      expect(result.stdout).toContain('play');
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('parameterize');
      expect(result.stdout).toContain('locales');
      expect(result.stdout).toContain('translations');
      expect(result.stdout).toContain('import');
      expect(result.stdout).toContain('web');
    });
  });

  describe('--version flag', () => {
    it('should display version number', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('command help', () => {
    const commands = [
      'init',
      'devices',
      'record',
      'play',
      'run',
      'export',
      'parameterize',
      'import',
      'web',
    ];

    commands.forEach((command) => {
      it(`should display help for ${command} command`, async () => {
        const result = await runCLI([command, '--help']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(command);
        expect(result.stdout).toContain('Usage');
      });
    });
  });

  describe('invalid command', () => {
    it('should show error for unknown command', async () => {
      const result = await runCLI(['invalid-command']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain('unknown command');
    });
  });
});
