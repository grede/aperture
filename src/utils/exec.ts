import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * Execute result
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute options
 */
export interface ExecOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Log command execution */
  logCommand?: boolean;
}

/**
 * Execute a command with proper error handling
 * Uses execFile (not exec) to prevent shell injection vulnerabilities
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { timeout = 30000, cwd, env, logCommand = true } = options;

  if (logCommand) {
    logger.debug({ command, args }, 'Executing command');
  }

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout,
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string; killed?: boolean };

    if (err.killed) {
      const cmdStr = `${command} ${args.join(' ')}`;
      logger.error({ command, args, timeout }, 'Command timed out');
      throw new Error(`Command timed out after ${timeout}ms: ${cmdStr}`);
    }

    logger.error({ command, args, error: err }, 'Command failed');

    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? '',
      exitCode: err.code ?? 1,
    };
  }
}

/**
 * Execute xcrun simctl command
 */
export async function simctl(args: string[], options: ExecOptions = {}): Promise<ExecResult> {
  return exec('xcrun', ['simctl', ...args], options);
}

/**
 * Execute xcrun command
 */
export async function xcrun(args: string[], options: ExecOptions = {}): Promise<ExecResult> {
  return exec('xcrun', args, options);
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    await exec('which', [command], { logCommand: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify required system dependencies
 */
export async function verifySystemDependencies(): Promise<{
  xcode: boolean;
  simctl: boolean;
}> {
  const [xcode, simctl] = await Promise.all([
    commandExists('xcodebuild'),
    commandExists('xcrun'),
  ]);

  return { xcode, simctl };
}
