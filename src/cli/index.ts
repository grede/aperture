#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devicesCommand } from './commands/devices.js';
import { recordCommand } from './commands/record.js';
import { playCommand } from './commands/play.js';
import { serverCommand } from './commands/server.js';
import { parameterizeCommand } from './commands/parameterize.js';
import { localesCommand } from './commands/locales.js';

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
  .action(playCommand);

// Parameterize command
program
  .command('parameterize <recording>')
  .description('Analyze recording and create parameterized template (US-009)')
  .option('--force', 'Force re-analysis even if template exists')
  .action(parameterizeCommand);

// Locales command
program.addCommand(localesCommand);

// Run command (placeholder)
program
  .command('run <template>')
  .description('Run template across all locales')
  .option('--locales <locales>', 'Comma-separated locale list or "all"')
  .action((template) => {
    console.log(`Running template: ${template} (coming soon - US-014)`);
  });

// Export command (placeholder)
program
  .command('export <template>')
  .description('Export screenshots with templates')
  .option('--style <style>', 'Template style (minimal|modern|gradient|dark|playful)')
  .action((template) => {
    console.log(`Exporting template: ${template} (coming soon - US-017)`);
  });

// Parse arguments
program.parse();
