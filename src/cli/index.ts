#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devicesCommand } from './commands/devices.js';

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

// Record command (placeholder)
program
  .command('record')
  .description('Start recording a walkthrough')
  .option('--name <name>', 'Recording name')
  .action(() => {
    console.log('Recording feature coming soon (US-003)');
  });

// Play command (placeholder)
program
  .command('play <recording>')
  .description('Replay a recording')
  .action((recording) => {
    console.log(`Playing recording: ${recording} (coming soon - US-005)`);
  });

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
