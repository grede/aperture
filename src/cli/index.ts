#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { flowCommand } from './commands/flow.js';
import { doctorCommand } from './commands/doctor.js';
import { devicesCommand } from './commands/devices.js';
import { runCommand } from './commands/run.js';
import { exportCommand } from './commands/export.js';
import { generateDataCommand } from './commands/generate-data.js';
import { generateCopyCommand } from './commands/generate-copy.js';
import { convertImagesCommand } from './commands/convert-images.js';
import { resizeImagesCommand } from './commands/resize-images.js';

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
  .option('--config <path>', 'Path to config YAML file (default: aperture.config.yaml)')
  .option('--flow <path>', 'Path to flow YAML file (overrides config)')
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
  .option('--device <type>', 'Export for specific device (iphone|ipad|android|both|all)', 'both')
  .option('--frame <mode>', 'Frame mode (none|minimal|realistic)')
  .option('--frame-assets <dir>', 'Path to realistic frame assets directory')
  .action(exportCommand);

// Generate-data command
program
  .command('generate-data')
  .description('Generate locale-specific test data')
  .option('--regenerate', 'Overwrite existing locale data files')
  .option('--locale <locale>', 'Generate data for a single locale only')
  .option('--model <model>', 'Override LLM model (e.g., gpt-4o, gpt-4o-mini)')
  .action(generateDataCommand);

// Generate-copy command
program
  .command('generate-copy')
  .description('Generate localized marketing copy')
  .option('--regenerate', 'Overwrite existing copy files')
  .option('--locale <locale>', 'Generate copy for a single locale only')
  .option('--model <model>', 'Override LLM model (e.g., gpt-4o, gpt-4o-mini)')
  .option('--description <text>', 'Override app description from config')
  .action(generateCopyCommand);

// Convert-images command
program
  .command('convert-images <input>')
  .description('Convert PNG images to JPG and flatten alpha channels')
  .option('--output <path>', 'Output file or directory (defaults to next to the source PNGs)')
  .option('--quality <number>', 'JPEG quality from 1 to 100', '92')
  .option('--background <color>', 'Background color used when flattening transparency', '#ffffff')
  .option('--overwrite', 'Overwrite existing JPG files')
  .option('--no-recursive', 'Do not scan subfolders when the input is a directory')
  .action(convertImagesCommand);

// Resize-images command
program
  .command('resize-images <input>')
  .description('Batch-resize images to a target size')
  .requiredOption('--size <dimensions>', 'Target size in WIDTHxHEIGHT format, for example 100x100')
  .option(
    '--output <path>',
    'Output file or directory (defaults to creating suffixed files next to the source)'
  )
  .option('--fit <mode>', 'Resize fit mode (contain|cover|fill|inside|outside)', 'fill')
  .option('--background <color>', 'Background color used by fit modes that add padding', '#ffffff')
  .option('--overwrite', 'Overwrite existing output files')
  .option('--no-recursive', 'Do not scan subfolders when the input is a directory')
  .action(resizeImagesCommand);

// Parse arguments
program.parse();
