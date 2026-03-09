import { mkdir, readdir, stat } from 'fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import sharp from 'sharp';

interface ResizeImagesOptions {
  size?: string;
  output?: string;
  recursive?: boolean;
  overwrite?: boolean;
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  background?: string;
}

interface ResolvedPaths {
  inputPath: string;
  outputRoot?: string;
  inputIsDirectory: boolean;
}

interface ImageSize {
  width: number;
  height: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const FIT_MODES = new Set<NonNullable<ResizeImagesOptions['fit']>>([
  'contain',
  'cover',
  'fill',
  'inside',
  'outside',
]);

export async function resizeImagesCommand(
  input: string,
  options: ResizeImagesOptions
): Promise<void> {
  console.log(chalk.bold.blue('\n📐 Aperture Resize Images\n'));

  let size: ImageSize;
  let paths: ResolvedPaths;

  try {
    size = resolveSize(options.size);
    paths = await resolvePaths(input, options.output);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }

  const recursive = options.recursive ?? true;
  const overwrite = options.overwrite ?? false;
  const fit = resolveFit(options.fit);
  const background = options.background ?? '#ffffff';
  const imageFiles = await collectImageFiles(paths.inputPath, paths.inputIsDirectory, recursive);

  if (imageFiles.length === 0) {
    console.log(chalk.yellow('No supported images found to resize.\n'));
    return;
  }

  const spinner = ora(`Resizing ${imageFiles.length} image(s)...`).start();

  let resized = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of imageFiles) {
    const destinationPath = buildDestinationPath(filePath, paths, size);

    if (!overwrite && (await fileExists(destinationPath))) {
      skipped++;
      spinner.text = `Skipping existing file: ${destinationPath}`;
      continue;
    }

    try {
      await mkdir(dirname(destinationPath), { recursive: true });
      await sharp(filePath)
        .resize({
          width: size.width,
          height: size.height,
          fit,
          background,
        })
        .toFile(destinationPath);

      resized++;
      spinner.text = `Resized: ${destinationPath}`;
    } catch (error) {
      failed++;
      spinner.warn(`Failed: ${filePath}`);
      console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
      spinner.start(
        `Continuing with remaining files (${resized + skipped + failed}/${imageFiles.length})...`
      );
    }
  }

  if (failed > 0) {
    spinner.warn('Image resize completed with errors');
  } else {
    spinner.succeed('Image resize complete');
  }

  console.log(`  Source: ${chalk.cyan(paths.inputPath)}`);
  if (paths.outputRoot) {
    console.log(`  Output: ${chalk.cyan(paths.outputRoot)}`);
  } else if (paths.inputIsDirectory) {
    console.log(
      `  Output: ${chalk.cyan(paths.inputPath)} (using -${size.width}x${size.height} suffixes)`
    );
  } else {
    console.log(`  Output: ${chalk.cyan(buildDestinationPath(paths.inputPath, paths, size))}`);
  }
  console.log(`  Resized: ${chalk.cyan(resized)} file(s)`);
  if (skipped > 0) {
    console.log(`  Skipped: ${chalk.yellow(skipped)} existing file(s)`);
  }
  if (failed > 0) {
    console.log(`  Failed: ${chalk.red(failed)} file(s)`);
    process.exit(1);
  }
  console.log(`  Size: ${chalk.cyan(`${size.width}x${size.height}`)}`);
  console.log(`  Fit: ${chalk.cyan(fit)}`);
  console.log(`  Background: ${chalk.cyan(background)}\n`);
}

function resolveSize(rawSize?: string): ImageSize {
  if (!rawSize) {
    throw new Error(
      'Image size is required. Use --size <width>x<height>, for example --size 100x100.'
    );
  }

  const match = rawSize.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) {
    throw new Error('Invalid size format. Use <width>x<height>, for example 100x100.');
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (width < 1 || height < 1) {
    throw new Error('Width and height must both be greater than 0.');
  }

  return { width, height };
}

function resolveFit(rawFit?: ResizeImagesOptions['fit']): NonNullable<ResizeImagesOptions['fit']> {
  const fit = rawFit ?? 'fill';

  if (!FIT_MODES.has(fit)) {
    throw new Error('Fit must be one of: contain, cover, fill, inside, outside.');
  }

  return fit;
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

  return {
    inputPath,
    inputIsDirectory,
    outputRoot: resolve(process.cwd(), output),
  };
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

function buildDestinationPath(filePath: string, paths: ResolvedPaths, size: ImageSize): string {
  const extension = extname(filePath);
  const fileName = `${basename(filePath, extension)}${resolveSuffix(paths, size)}${extension}`;

  if (!paths.outputRoot) {
    return join(dirname(filePath), fileName);
  }

  if (!paths.inputIsDirectory) {
    const outputExtension = extname(paths.outputRoot);
    if (SUPPORTED_EXTENSIONS.has(outputExtension.toLowerCase())) {
      return paths.outputRoot;
    }

    return join(paths.outputRoot, `${basename(filePath, extension)}${extension}`);
  }

  const relativePath = relative(paths.inputPath, filePath);
  const relativeDirectory = dirname(relativePath);

  if (relativeDirectory === '.') {
    return join(paths.outputRoot, `${basename(filePath, extension)}${extension}`);
  }

  return join(paths.outputRoot, relativeDirectory, `${basename(filePath, extension)}${extension}`);
}

function resolveSuffix(paths: ResolvedPaths, size: ImageSize): string {
  if (paths.outputRoot) {
    return '';
  }

  return `-${size.width}x${size.height}`;
}

function isSupportedImage(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
