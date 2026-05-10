import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { basename, dirname, extname, join, parse, relative, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  compositeScreenshotWithRealisticFrame,
  resolveFrameAssetsDir,
  resolveRealisticFrameAsset,
} from '../../templates/realistic-frame-assets.js';
import type { TemplateDeviceType } from '../../types/index.js';

interface FrameOptions {
  deviceFrame?: string;
  frameAssets?: string;
  output?: string;
  recursive?: boolean;
  overwrite?: boolean;
  listFrames?: boolean;
}

interface ResolvedPaths {
  inputPath: string;
  outputRoot?: string;
  inputIsDirectory: boolean;
}

const SUPPORTED_INPUT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const OUTPUT_EXTENSION = '.png';
const OUTPUT_SUFFIX = '-framed';

export async function frameCommand(
  input: string | undefined,
  options: FrameOptions
): Promise<void> {
  console.log(chalk.bold.blue('\nAperture Frame\n'));

  if (options.listFrames) {
    await listAvailableFrames(options.frameAssets);
    return;
  }

  if (!input) {
    console.error(chalk.red('Input path is required. Provide one image or a folder of images.'));
    process.exit(1);
  }

  if (!options.deviceFrame) {
    console.error(
      chalk.red('Device frame is required. Use --device-frame <file> or --list-frames.')
    );
    process.exit(1);
  }

  let paths: ResolvedPaths;
  let selectedFrameFile: string;
  let frameAssetsDir: string | undefined;

  try {
    paths = await resolvePaths(input, options.output);
    frameAssetsDir = await resolveFrameAssetsDir(options.frameAssets);
    selectedFrameFile = await resolveDeviceFrameFile(options.deviceFrame, frameAssetsDir);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  const recursive = options.recursive ?? true;
  const overwrite = options.overwrite ?? false;
  const imageFiles = await collectImageFiles(paths.inputPath, paths.inputIsDirectory, recursive);

  if (imageFiles.length === 0) {
    console.log(chalk.yellow('No supported images found to frame.\n'));
    return;
  }

  const deviceType = inferDeviceTypeFromFrameFile(selectedFrameFile);
  const frameAsset = await resolveRealisticFrameAsset({
    deviceType,
    assetsDir: frameAssetsDir,
    preferredFileName: selectedFrameFile,
  });

  if (!frameAsset) {
    console.error(chalk.red(`Could not load device frame metadata for: ${selectedFrameFile}`));
    process.exit(1);
  }

  const spinner = ora(`Framing ${imageFiles.length} image(s)...`).start();

  let framed = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of imageFiles) {
    const destinationPath = buildDestinationPath(filePath, paths);

    if (!overwrite && (await fileExists(destinationPath))) {
      skipped++;
      spinner.text = `Skipping existing file: ${destinationPath}`;
      continue;
    }

    try {
      const screenshot = await readFile(filePath);
      const result = await compositeScreenshotWithRealisticFrame({
        screenshot,
        frameAsset,
      });

      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, result.image);

      framed++;
      spinner.text = `Framed: ${destinationPath}`;
    } catch (error) {
      failed++;
      spinner.warn(`Failed: ${filePath}`);
      console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
      spinner.start(
        `Continuing with remaining files (${framed + skipped + failed}/${imageFiles.length})...`
      );
    }
  }

  if (failed > 0) {
    spinner.warn('Image framing completed with errors');
  } else {
    spinner.succeed('Image framing complete');
  }

  console.log(`  Source: ${chalk.cyan(paths.inputPath)}`);
  if (paths.outputRoot) {
    console.log(`  Output: ${chalk.cyan(paths.outputRoot)}`);
  } else if (paths.inputIsDirectory) {
    console.log(`  Output: ${chalk.cyan(paths.inputPath)} (using ${OUTPUT_SUFFIX} suffixes)`);
  } else {
    console.log(`  Output: ${chalk.cyan(buildDestinationPath(paths.inputPath, paths))}`);
  }
  console.log(`  Frame: ${chalk.cyan(selectedFrameFile)}`);
  console.log(`  Framed: ${chalk.cyan(framed)} file(s)`);
  if (skipped > 0) {
    console.log(`  Skipped: ${chalk.yellow(skipped)} existing file(s)`);
  }
  if (failed > 0) {
    console.log(`  Failed: ${chalk.red(failed)} file(s)`);
    process.exit(1);
  }
  console.log('');
}

async function listAvailableFrames(frameAssets?: string): Promise<void> {
  const frameAssetsDir = await resolveFrameAssetsDir(frameAssets);

  if (!frameAssetsDir) {
    console.error(
      chalk.red('No device frame assets directory found. Use --frame-assets <dir> to specify one.')
    );
    process.exit(1);
  }

  const frameFiles = await readFrameFiles(frameAssetsDir);

  if (frameFiles.length === 0) {
    console.log(chalk.yellow(`No PNG device frames found in ${frameAssetsDir}.\n`));
    return;
  }

  console.log(`Device frames in ${chalk.cyan(frameAssetsDir)}:\n`);
  for (const frameFile of frameFiles) {
    console.log(`  ${frameFile}`);
  }
  console.log('');
}

async function resolvePaths(input: string, output?: string): Promise<ResolvedPaths> {
  const inputPath = resolve(process.cwd(), input);
  const inputStats = await stat(inputPath).catch(() => null);

  if (!inputStats) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  const inputIsDirectory = inputStats.isDirectory();
  if (!inputIsDirectory && !isSupportedImage(inputPath)) {
    throw new Error('Input file must be a PNG, JPG, JPEG, or WEBP image.');
  }

  if (!output) {
    return { inputPath, inputIsDirectory };
  }

  const outputRoot = resolve(process.cwd(), output);
  const outputExtension = extname(outputRoot).toLowerCase();

  if (inputIsDirectory && outputExtension.length > 0) {
    throw new Error('Output must be a directory when input is a directory.');
  }

  if (!inputIsDirectory && outputExtension.length > 0 && outputExtension !== OUTPUT_EXTENSION) {
    throw new Error('Output file must end with .png, or point to a directory.');
  }

  return { inputPath, inputIsDirectory, outputRoot };
}

async function resolveDeviceFrameFile(rawFrame: string, frameAssetsDir?: string): Promise<string> {
  if (!frameAssetsDir) {
    throw new Error('No device frame assets directory found. Use --frame-assets <dir>.');
  }

  const frameFiles = await readFrameFiles(frameAssetsDir);
  const requested = rawFrame.trim();
  const normalizedRequested = requested.toLowerCase();
  const requestedWithExtension = normalizedRequested.endsWith(OUTPUT_EXTENSION)
    ? normalizedRequested
    : `${normalizedRequested}${OUTPUT_EXTENSION}`;

  const exactMatch = frameFiles.find((file) => file.toLowerCase() === normalizedRequested);
  if (exactMatch) return exactMatch;

  const extensionMatch = frameFiles.find((file) => file.toLowerCase() === requestedWithExtension);
  if (extensionMatch) return extensionMatch;

  const baseNameMatch = frameFiles.find(
    (file) => parse(file).name.toLowerCase() === normalizedRequested
  );
  if (baseNameMatch) return baseNameMatch;

  const available = frameFiles.length > 0 ? ` Available frames: ${frameFiles.join(', ')}` : '';
  throw new Error(`Device frame not found: ${rawFrame}.${available}`);
}

async function readFrameFiles(frameAssetsDir: string): Promise<string[]> {
  const entries = await readdir(frameAssetsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === OUTPUT_EXTENSION)
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function inferDeviceTypeFromFrameFile(frameFile: string): TemplateDeviceType {
  const lower = frameFile.toLowerCase();

  if (lower.includes('ipad')) {
    return 'iPad';
  }

  if (/(android|nexus|pixel|galaxy|oneplus|xiaomi|redmi|huawei|motorola)/.test(lower)) {
    return 'Android';
  }

  return 'iPhone';
}

async function collectImageFiles(
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
  const imageFiles: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        imageFiles.push(...(await walkDirectory(fullPath, recursive)));
      }
      continue;
    }

    if (entry.isFile() && isSupportedImage(entry.name)) {
      imageFiles.push(fullPath);
    }
  }

  return imageFiles.sort((left, right) => left.localeCompare(right));
}

function buildDestinationPath(filePath: string, paths: ResolvedPaths): string {
  if (!paths.inputIsDirectory) {
    if (!paths.outputRoot) {
      return join(
        dirname(filePath),
        `${basename(filePath, extname(filePath))}${OUTPUT_SUFFIX}.png`
      );
    }

    const outputExtension = extname(paths.outputRoot).toLowerCase();
    if (outputExtension === OUTPUT_EXTENSION) {
      return paths.outputRoot;
    }

    return join(paths.outputRoot, `${basename(filePath, extname(filePath))}.png`);
  }

  const relativePath = relative(paths.inputPath, filePath);
  const relativeDirectory = dirname(relativePath);
  const fileName = `${basename(filePath, extname(filePath))}${resolveSuffix(paths)}.png`;
  const outputBase = paths.outputRoot ?? paths.inputPath;

  if (relativeDirectory === '.') {
    return join(outputBase, fileName);
  }

  return join(outputBase, relativeDirectory, fileName);
}

function resolveSuffix(paths: ResolvedPaths): string {
  if (paths.outputRoot) {
    return '';
  }

  return OUTPUT_SUFFIX;
}

function isSupportedImage(filePath: string): boolean {
  return SUPPORTED_INPUT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
