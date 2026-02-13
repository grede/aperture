#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devicesCommand } from './commands/devices.js';
import { recordCommand } from './commands/record.js';
import { playCommand } from './commands/play.js';
import { serverCommand } from './commands/server.js';
import { parameterizeCommand } from './commands/parameterize.js';
import { localesCommand } from './commands/locales.js';
import { runCommand } from './commands/run.js';
import { exportCommand } from './commands/export.js';
import { translationsCommand } from './commands/translations.js';

const program = new Command();

program
  .name('aperture')
  .description('AI-powered localized app store screenshot automation')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new Aperture project with interactive setup wizard')
  .option('--yes', 'Use default values without prompting')
  .option('--app <path>', 'Path to .app or .ipa bundle')
  .action(initCommand);

// Devices command
program
  .command('devices')
  .description('List available iOS Simulators')
  .option('--booted', 'Show only booted devices')
  .option('--json', 'Output as JSON')
  .action(devicesCommand);

// Server command
program.addCommand(serverCommand);

// Record command
program
  .command('record')
  .description('Start recording a walkthrough')
  .option('--name <name>', 'Recording name')
  .option('--device <udid>', 'Simulator UDID')
  .option('--no-auto-appium', 'Disable automatic Appium server management')
  .option('--appium-port <port>', 'Appium server port (default: 8100)')
  .action(recordCommand);

// Play command
program
  .command('play <recording>')
  .description('Replay a recording')
  .option('--device <udid>', 'Simulator UDID')
  .option('--locale <locale>', 'Locale code (e.g., en, de, fr)')
  .option('--output-dir <dir>', 'Output directory for screenshots')
  .option('--no-auto-appium', 'Disable automatic Appium server management')
  .option('--appium-port <port>', 'Appium server port (default: 8100)')
  .option('--no-cache', 'Force fresh selector resolution, ignore cache (US-016)')
  .action(playCommand);

// Parameterize command
program
  .command('parameterize <recording>')
  .description('Analyze recording and create parameterized template (US-009)')
  .option('--force', 'Force re-analysis even if template exists')
  .action(parameterizeCommand);

// Locales command
program.addCommand(localesCommand);

// Translations command (US-018)
program.addCommand(translationsCommand);

// Run command (US-014)
program
  .command('run <template>')
  .description('Run template across all locales (US-014)')
  .option('--locales <locales>', 'Comma-separated locale list or "all" (default: all configured)')
  .option('--device <udid>', 'Simulator UDID')
  .option('--output-dir <dir>', 'Output directory for screenshots')
  .option('--no-auto-appium', 'Disable automatic Appium server management')
  .option('--appium-port <port>', 'Appium server port (default: 8100)')
  .option('--no-cache', 'Force fresh selector resolution, ignore cache (US-016)')
  .action(runCommand);

// Export command (US-017)
program
  .command('export <template>')
  .description('Export screenshots with templates (US-017)')
  .option('--style <style>', 'Template style (minimal|modern|gradient|dark|playful)')
  .option('--locales <locales>', 'Comma-separated locale list or "all" (default: all configured)')
  .option('--devices <devices>', 'Comma-separated device list (iphone,ipad) or "all" (default: all)')
  .option('--output-dir <dir>', 'Output directory for exports')
  .action(exportCommand);

// Parse arguments
program.parse();
