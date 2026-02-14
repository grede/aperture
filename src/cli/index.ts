#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { flowCommand } from './commands/flow.js';
import { doctorCommand } from './commands/doctor.js';
import { devicesCommand } from './commands/devices.js';
import { runCommand } from './commands/run.js';
import { exportCommand } from './commands/export.js';
import { generateDataCommand } from './commands/generate-data.js';
import { generateCopyCommand } from './commands/generate-copy.js';

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

// Flow command
program
  .command('flow')
  .description('Interactive flow editor wizard')
  .option('--file <path>', 'Path to flow YAML file', 'aperture-flow.yaml')
  .action(flowCommand);

// Doctor command
program
  .command('doctor')
  .description('Check system requirements and install dependencies')
  .option('--fix', 'Automatically fix issues without prompting')
  .action(doctorCommand);

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

// Export command
program
  .command('export')
  .description('Composite screenshots into store-ready images')
  .option('--style <style>', 'Template style (minimal|modern|gradient|dark|playful)')
  .option('--locale <locale>', 'Export for a single locale only')
  .option('--device <type>', 'Export for specific device (iphone|ipad|both)', 'both')
  .action(exportCommand);

// Generate-data command
program
  .command('generate-data')
  .description('Generate locale-specific test data')
  .option('--regenerate', 'Overwrite existing locale data files')
  .option('--locale <locale>', 'Generate data for a single locale only')
  .action(generateDataCommand);

// Generate-copy command
program
  .command('generate-copy')
  .description('Generate localized marketing copy')
  .option('--regenerate', 'Overwrite existing copy files')
  .option('--locale <locale>', 'Generate copy for a single locale only')
  .action(generateCopyCommand);

// Parse arguments
program.parse();
