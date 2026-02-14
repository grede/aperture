#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { devicesCommand } from './commands/devices.js';
import { runCommand } from './commands/run.js';

const program = new Command();

program
  .name('aperture')
  .description('AI-powered localized app store screenshot automation')
  .version('0.2.0');

// Init command
program
  .command('init')
  .description('Initialize a new Aperture project with interactive setup wizard')
  .option('--yes', 'Use default values without prompting')
  .option('--app <path>', 'Path to .app bundle')
  .action(initCommand);

// Devices command
program
  .command('devices')
  .description('List available iOS Simulators')
  .option('--booted', 'Show only booted devices')
  .option('--json', 'Output as JSON')
  .action(devicesCommand);

// Run command
program
  .command('run')
  .description('Execute flow and capture screenshots')
  .option('--flow <path>', 'Path to flow YAML file')
  .option('--locale <locale>', 'Run for a single locale only')
  .option('--device <type>', 'Run for specific device (iphone|ipad|both)', 'both')
  .option('--dry-run', 'Show planned actions without executing')
  .option('--verbose', 'Enable verbose logging')
  .action(runCommand);

// Export command (placeholder)
program
  .command('export')
  .description('Composite screenshots into store-ready images')
  .option('--style <style>', 'Template style')
  .action(() => {
    console.log(chalk.yellow('Export command coming in Milestone 2 (Template Engine)'));
  });

// Generate-data command (placeholder)
program
  .command('generate-data')
  .description('Generate locale-specific test data')
  .option('--regenerate', 'Overwrite existing locale data files')
  .action(() => {
    console.log(chalk.yellow('Generate-data command coming in Milestone 2 (Localization)'));
  });

// Generate-copy command (placeholder)
program
  .command('generate-copy')
  .description('Generate localized marketing copy')
  .action(() => {
    console.log(chalk.yellow('Generate-copy command coming in Milestone 2 (Localization)'));
  });

// Parse arguments
program.parse();
