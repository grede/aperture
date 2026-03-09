import { mkdir, readdir, stat } from 'fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import sharp from 'sharp';

interface ConvertImagesOptions {
  output?: string;
  recursive?: boolean;
  overwrite?: boolean;
  quality?: string;
  background?: string;
}

interface ResolvedPaths {
  inputPath: string;
  outputRoot?: string;
  inputIsDirectory: boolean;
}

const JPEG_EXTENSIONS = new Set(['.jpg', '.jpeg']);

export async function convertImagesCommand(
  input: string,
  options: ConvertImagesOptions
): Promise<void> {
  console.log(chalk.bold.blue('\n🖼️  Aperture Convert Images\n'));

  const quality = resolveQuality(options.quality);
  const background = options.background ?? '#ffffff';
  const recursive = options.recursive ?? true;
  const overwrite = options.overwrite ?? false;

  let paths: ResolvedPaths;
  try {
    paths = await resolvePaths(input, options.output);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  const pngFiles = await collectPngFiles(paths.inputPath, paths.inputIsDirectory, recursive);

  if (pngFiles.length === 0) {
    console.log(chalk.yellow('No PNG files found to convert.\n'));
    return;
  }

  const spinner = ora(`Converting ${pngFiles.length} PNG file(s)...`).start();

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of pngFiles) {
    const destinationPath = buildDestinationPath(filePath, paths);

    if (!overwrite && (await fileExists(destinationPath))) {
      skipped++;
      spinner.text = `Skipping existing file: ${destinationPath}`;
      continue;
    }

    try {
      await mkdir(dirname(destinationPath), { recursive: true });
      await sharp(filePath).flatten({ background }).jpeg({ quality }).toFile(destinationPath);

      converted++;
      spinner.text = `Converted: ${destinationPath}`;
    } catch (error) {
      failed++;
      spinner.warn(`Failed: ${filePath}`);
      console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
      spinner.start(
        `Continuing with remaining files (${converted + skipped + failed}/${pngFiles.length})...`
      );
    }
  }

  if (failed > 0) {
    spinner.warn('Image conversion completed with errors');
  } else {
    spinner.succeed('Image conversion complete');
  }

  console.log(`  Source: ${chalk.cyan(paths.inputPath)}`);
  if (paths.outputRoot) {
    console.log(`  Output: ${chalk.cyan(paths.outputRoot)}`);
  } else if (paths.inputIsDirectory) {
    console.log(`  Output: ${chalk.cyan(paths.inputPath)} (next to source PNG files)`);
  } else {
    console.log(`  Output: ${chalk.cyan(buildDestinationPath(paths.inputPath, paths))}`);
  }
  console.log(`  Converted: ${chalk.cyan(converted)} file(s)`);
  if (skipped > 0) {
    console.log(`  Skipped: ${chalk.yellow(skipped)} existing file(s)`);
  }
  if (failed > 0) {
    console.log(`  Failed: ${chalk.red(failed)} file(s)`);
    process.exit(1);
  }
  console.log(`  Quality: ${chalk.cyan(String(quality))}`);
  console.log(`  Background: ${chalk.cyan(background)}\n`);
}

function resolveQuality(rawQuality?: string): number {
  if (!rawQuality) {
    return 92;
  }

  const quality = Number.parseInt(rawQuality, 10);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error('Quality must be an integer between 1 and 100.');
  }

  return quality;
}

async function resolvePaths(input: string, output?: string): Promise<ResolvedPaths> {
  const inputPath = resolve(process.cwd(), input);
  const inputStats = await stat(inputPath).catch(() => null);

  if (!inputStats) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  const inputIsDirectory = inputStats.isDirectory();
  if (!inputIsDirectory && !isPngFile(inputPath)) {
    throw new Error('Input file must be a PNG image.');
  }

  if (!output) {
    return { inputPath, inputIsDirectory };
  }

  const resolvedOutput = resolve(process.cwd(), output);

  if (inputIsDirectory) {
    return {
      inputPath,
      inputIsDirectory,
      outputRoot: resolvedOutput,
    };
  }

  const outputExtension = extname(resolvedOutput).toLowerCase();
  if (outputExtension.length === 0) {
    return {
      inputPath,
      inputIsDirectory,
      outputRoot: resolvedOutput,
    };
  }

  if (!JPEG_EXTENSIONS.has(outputExtension)) {
    throw new Error('Output file must end with .jpg or .jpeg, or point to a directory.');
  }

  return {
    inputPath,
    inputIsDirectory,
    outputRoot: resolvedOutput,
  };
}

async function collectPngFiles(
  inputPath: string,
  inputIsDirectory: boolean,
  recursive: boolean
): Promise<string[]> {
  if (!inputIsDirectory) {
    return [inputPath];
  }

  return walkDirectory(inputPath, recursive);
}

async function walkDirectory(directoryPath: string, recursive: boolean): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const pngFiles: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        pngFiles.push(...(await walkDirectory(fullPath, recursive)));
      }
      continue;
    }

    if (entry.isFile() && isPngFile(entry.name)) {
      pngFiles.push(fullPath);
    }
  }

  return pngFiles.sort((left, right) => left.localeCompare(right));
}

function buildDestinationPath(filePath: string, paths: ResolvedPaths): string {
  if (!paths.inputIsDirectory) {
    if (!paths.outputRoot) {
      return join(dirname(filePath), `${basename(filePath, extname(filePath))}.jpg`);
    }

    const outputExtension = extname(paths.outputRoot).toLowerCase();
    if (JPEG_EXTENSIONS.has(outputExtension)) {
      return paths.outputRoot;
    }

    return join(paths.outputRoot, `${basename(filePath, extname(filePath))}.jpg`);
  }

  const relativePath = relative(paths.inputPath, filePath);
  const relativeDirectory = dirname(relativePath);
  const fileName = `${basename(filePath, extname(filePath))}.jpg`;
  const outputBase = paths.outputRoot ?? paths.inputPath;

  if (relativeDirectory === '.') {
    return join(outputBase, fileName);
  }

  return join(outputBase, relativeDirectory, fileName);
}

function isPngFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === '.png';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
