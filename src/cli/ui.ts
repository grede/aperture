import chalk from 'chalk';
import ora, { type Ora } from 'ora';

/**
 * CLI UI helpers for consistent formatting and feedback
 */

/**
 * Create a spinner for long-running operations
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Format success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Format error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Format warning message
 */
export function warning(message: string): void {
  console.warn(chalk.yellow('⚠'), message);
}

/**
 * Format info message
 */
export function info(message: string): void {
  console.log(chalk.cyan('ℹ'), message);
}

/**
 * Format section header
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold.cyan(text));
  console.log(chalk.gray('─'.repeat(text.length)));
}

/**
 * Format list item
 */
export function listItem(text: string, indent = 0): void {
  const prefix = ' '.repeat(indent * 2);
  console.log(`${prefix}${chalk.dim('•')} ${text}`);
}

/**
 * Format key-value pair
 */
export function keyValue(key: string, value: string, indent = 0): void {
  const prefix = ' '.repeat(indent * 2);
  console.log(`${prefix}${chalk.dim(key + ':')} ${value}`);
}

/**
 * Clear console
 */
export function clear(): void {
  console.clear();
}

/**
 * Print welcome banner
 */
export function banner(): void {
  console.log();
  console.log(chalk.bold.cyan('  📸 Aperture'));
  console.log(chalk.gray('  AI-powered app store screenshot automation'));
  console.log();
}

/**
 * Format progress indicator
 */
export function progress(current: number, total: number, message: string): void {
  const percent = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  console.log(chalk.cyan(`[${bar}] ${percent}%`) + ` ${message}`);
}
