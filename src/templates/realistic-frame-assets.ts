import { readdir, readFile, stat } from 'fs/promises';
import { join, parse } from 'path';
import sharp from 'sharp';
import type { TemplateDeviceType } from '../types/index.js';

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

export interface RealisticFrameAsset {
  overlay: Buffer;
  overlayWidth: number;
  overlayHeight: number;
  screen: ScreenRect;
  sourceFile: string;
}

interface RealisticFrameCandidate {
  filePath: string;
  fileName: string;
  overlayWidth: number;
  overlayHeight: number;
  screen: ScreenRect;
}

const TRANSPARENCY_THRESHOLD = 10;
const DEFAULT_FRAME_ASSETS_DIR = 'device_frames';
const IPHONE_PREFERRED_FRAME_FILES = [
  'iphone 17 pro - silver - portrait.png',
  'apple iphone 17 pro - silver - portrait.png',
];
const DEFAULT_SCREEN_ASPECT: Record<TemplateDeviceType, number> = {
  iPhone: 430 / 932,
  iPad: 3 / 4,
  Android: 9 / 19.5,
};

const candidateCache = new Map<string, Promise<RealisticFrameCandidate[]>>();
const overlayBufferCache = new Map<string, Promise<Buffer>>();

export async function resolveFrameAssetsDir(explicitDir?: string): Promise<string | undefined> {
  if (explicitDir && (await isDirectory(explicitDir))) {
    return explicitDir;
  }

  const envDir = process.env.FRAME_ASSETS_DIR;
  if (envDir && (await isDirectory(envDir))) {
    return envDir;
  }

  const defaultDir = join(process.cwd(), DEFAULT_FRAME_ASSETS_DIR);
  if (await isDirectory(defaultDir)) {
    return defaultDir;
  }

  return undefined;
}

export async function resolveRealisticFrameAsset(options: {
  deviceType: TemplateDeviceType;
  assetsDir?: string;
  targetScreenAspect?: number;
}): Promise<RealisticFrameAsset | null> {
  const assetsDir = await resolveFrameAssetsDir(options.assetsDir);
  if (!assetsDir) {
    return null;
  }

  const candidates = await loadFrameCandidates(assetsDir, options.deviceType);
  if (candidates.length === 0) {
    return null;
  }

  const targetAspect = options.targetScreenAspect ?? DEFAULT_SCREEN_ASPECT[options.deviceType];
  const preferredCandidate =
    options.deviceType === 'iPhone'
      ? candidates.find((candidate) => {
          const lower = candidate.fileName.toLowerCase();
          return IPHONE_PREFERRED_FRAME_FILES.includes(lower) || lower.includes('pro max');
        })
      : undefined;
  if (preferredCandidate) {
    const overlay = await readOverlayBuffer(preferredCandidate.filePath);
    return {
      overlay,
      overlayWidth: preferredCandidate.overlayWidth,
      overlayHeight: preferredCandidate.overlayHeight,
      screen: preferredCandidate.screen,
      sourceFile: preferredCandidate.fileName,
    };
  }

  const selectedCandidate = candidates.slice().sort((a, b) => {
    const aAspect = a.screen.width / a.screen.height;
    const bAspect = b.screen.width / b.screen.height;
    const aScore = Math.abs(aAspect - targetAspect);
    const bScore = Math.abs(bAspect - targetAspect);

    if (aScore !== bScore) {
      return aScore - bScore;
    }

    const aArea = a.screen.width * a.screen.height;
    const bArea = b.screen.width * b.screen.height;
    return bArea - aArea;
  })[0];

  const overlay = await readOverlayBuffer(selectedCandidate.filePath);

  return {
    overlay,
    overlayWidth: selectedCandidate.overlayWidth,
    overlayHeight: selectedCandidate.overlayHeight,
    screen: selectedCandidate.screen,
    sourceFile: selectedCandidate.fileName,
  };
}

async function loadFrameCandidates(
  assetsDir: string,
  deviceType: TemplateDeviceType
): Promise<RealisticFrameCandidate[]> {
  const cacheKey = `${assetsDir}:${deviceType}`;
  const cached = candidateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loadPromise = (async () => {
    const allEntries = await readdir(assetsDir);
    const pngFiles = allEntries.filter((entry) => entry.toLowerCase().endsWith('.png'));
    if (pngFiles.length === 0) {
      return [];
    }

    const matchingFiles = filterFilesByDevice(pngFiles, deviceType);
    const filesToParse = matchingFiles.length > 0 ? matchingFiles : pngFiles;

    const parsed = await Promise.all(
      filesToParse.map((fileName) => parseFrameCandidate(assetsDir, fileName))
    );

    return parsed.filter((candidate): candidate is RealisticFrameCandidate => Boolean(candidate));
  })();

  candidateCache.set(cacheKey, loadPromise);
  return loadPromise;
}

function filterFilesByDevice(files: string[], deviceType: TemplateDeviceType): string[] {
  const matches = files.filter((fileName) => {
    const lower = fileName.toLowerCase();
    const isIPhone = lower.includes('iphone');
    const isIPad = lower.includes('ipad');
    const isAndroid = /(android|nexus|pixel|galaxy|oneplus|xiaomi|redmi|huawei|motorola)/.test(
      lower
    );

    if (deviceType === 'iPhone') return isIPhone;
    if (deviceType === 'iPad') return isIPad;
    return isAndroid && !isIPhone && !isIPad;
  });

  return matches;
}

async function parseFrameCandidate(
  assetsDir: string,
  fileName: string
): Promise<RealisticFrameCandidate | null> {
  const filePath = join(assetsDir, fileName);
  const overlay = await readOverlayBuffer(filePath);
  const metadata = await sharp(overlay).metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const screen =
    (await readScreenRectFromJSON(assetsDir, fileName)) ||
    (await detectScreenRectFromAlphaMask(overlay, metadata.width, metadata.height));

  if (!screen) {
    return null;
  }

  return {
    filePath,
    fileName,
    overlayWidth: metadata.width,
    overlayHeight: metadata.height,
    screen,
  };
}

async function readScreenRectFromJSON(
  assetsDir: string,
  fileName: string
): Promise<ScreenRect | null> {
  const metadataPath = join(assetsDir, `${parse(fileName).name}.json`);

  try {
    const metadataJSON = await readFile(metadataPath, 'utf-8');
    const parsed = JSON.parse(metadataJSON) as { screen?: Partial<ScreenRect> };
    return parseScreenRect(parsed.screen);
  } catch {
    return null;
  }
}

async function detectScreenRectFromAlphaMask(
  overlay: Buffer,
  width: number,
  height: number
): Promise<ScreenRect | null> {
  const { data, info } = await sharp(overlay)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels < 4) {
    return null;
  }

  const pixelCount = width * height;
  const transparent = new Uint8Array(pixelCount);

  for (let index = 0; index < pixelCount; index++) {
    transparent[index] = data[index * info.channels + 3] <= TRANSPARENCY_THRESHOLD ? 1 : 0;
  }

  const outsideTransparent = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const enqueueOutside = (pixelIndex: number) => {
    if (outsideTransparent[pixelIndex] === 1 || transparent[pixelIndex] === 0) {
      return;
    }
    outsideTransparent[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x++) {
    enqueueOutside(x);
    enqueueOutside((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueueOutside(y * width);
    enqueueOutside(y * width + (width - 1));
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = (pixelIndex - x) / width;

    if (x > 0) enqueueOutside(pixelIndex - 1);
    if (x < width - 1) enqueueOutside(pixelIndex + 1);
    if (y > 0) enqueueOutside(pixelIndex - width);
    if (y < height - 1) enqueueOutside(pixelIndex + width);
  }

  const visited = new Uint8Array(pixelCount);
  let bestArea = 0;
  let bestBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (
      transparent[pixelIndex] === 0 ||
      outsideTransparent[pixelIndex] === 1 ||
      visited[pixelIndex] === 1
    ) {
      continue;
    }

    head = 0;
    tail = 0;
    queue[tail++] = pixelIndex;
    visited[pixelIndex] = 1;

    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (head < tail) {
      const componentIndex = queue[head++];
      const x = componentIndex % width;
      const y = (componentIndex - x) / width;

      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? componentIndex - 1 : -1,
        x < width - 1 ? componentIndex + 1 : -1,
        y > 0 ? componentIndex - width : -1,
        y < height - 1 ? componentIndex + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          transparent[neighbor] === 1 &&
          outsideTransparent[neighbor] === 0 &&
          visited[neighbor] === 0
        ) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }

    if (area > bestArea) {
      bestArea = area;
      bestBounds = { minX, maxX, minY, maxY };
    }
  }

  if (!bestBounds || bestArea < pixelCount * 0.005) {
    return null;
  }

  const detectedWidth = bestBounds.maxX - bestBounds.minX + 1;
  const detectedHeight = bestBounds.maxY - bestBounds.minY + 1;
  const cornerRadius = estimateCornerRadiusFromMask({
    transparentMask: transparent,
    outsideMask: outsideTransparent,
    width,
    height,
    bounds: bestBounds,
    fallback: Math.round(Math.min(detectedWidth, detectedHeight) * 0.04),
  });

  return {
    x: bestBounds.minX,
    y: bestBounds.minY,
    width: detectedWidth,
    height: detectedHeight,
    cornerRadius,
  };
}

function estimateCornerRadiusFromMask(options: {
  transparentMask: Uint8Array;
  outsideMask: Uint8Array;
  width: number;
  height: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  fallback: number;
}): number {
  const { transparentMask, outsideMask, width, bounds, fallback } = options;
  const rectWidth = bounds.maxX - bounds.minX + 1;
  const rectHeight = bounds.maxY - bounds.minY + 1;

  const inScreen = (x: number, y: number): boolean => {
    const index = y * width + x;
    return transparentMask[index] === 1 && outsideMask[index] === 0;
  };

  const firstInRow = (y: number): number | null => {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (inScreen(x, y)) return x;
    }
    return null;
  };

  const lastInRow = (y: number): number | null => {
    for (let x = bounds.maxX; x >= bounds.minX; x--) {
      if (inScreen(x, y)) return x;
    }
    return null;
  };

  const probeRows = Math.max(
    8,
    Math.min(Math.floor(rectHeight / 2), Math.floor(rectWidth / 2), 240)
  );
  const cornerInsets = {
    topLeft: 0,
    topRight: 0,
    bottomLeft: 0,
    bottomRight: 0,
  };

  for (let y = bounds.minY; y < Math.min(bounds.maxY + 1, bounds.minY + probeRows); y++) {
    const firstX = firstInRow(y);
    const lastX = lastInRow(y);
    if (firstX !== null) {
      cornerInsets.topLeft = Math.max(cornerInsets.topLeft, firstX - bounds.minX);
    }
    if (lastX !== null) {
      cornerInsets.topRight = Math.max(cornerInsets.topRight, bounds.maxX - lastX);
    }
  }

  for (let y = bounds.maxY; y > Math.max(bounds.minY - 1, bounds.maxY - probeRows); y--) {
    const firstX = firstInRow(y);
    const lastX = lastInRow(y);
    if (firstX !== null) {
      cornerInsets.bottomLeft = Math.max(cornerInsets.bottomLeft, firstX - bounds.minX);
    }
    if (lastX !== null) {
      cornerInsets.bottomRight = Math.max(cornerInsets.bottomRight, bounds.maxX - lastX);
    }
  }

  const values = [
    cornerInsets.topLeft,
    cornerInsets.topRight,
    cornerInsets.bottomLeft,
    cornerInsets.bottomRight,
  ].filter((value) => value > 0);
  if (values.length === 0) {
    return fallback;
  }

  values.sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  const maxAllowed = Math.floor(Math.min(rectWidth, rectHeight) / 2);
  return Math.max(0, Math.min(maxAllowed, Math.round(median)));
}

function parseScreenRect(screen?: Partial<ScreenRect>): ScreenRect | null {
  if (!screen) return null;

  const x = Number(screen.x);
  const y = Number(screen.y);
  const width = Number(screen.width);
  const height = Number(screen.height);
  const cornerRadius = Number(screen.cornerRadius ?? 0);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }
  if (width <= 0 || height <= 0 || x < 0 || y < 0) {
    return null;
  }

  return { x, y, width, height, cornerRadius: Math.max(0, cornerRadius) };
}

async function readOverlayBuffer(filePath: string): Promise<Buffer> {
  const cached = overlayBufferCache.get(filePath);
  if (cached) {
    return cached;
  }

  const readPromise = readFile(filePath);
  overlayBufferCache.set(filePath, readPromise);
  return readPromise;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const pathStats = await stat(path);
    return pathStats.isDirectory();
  } catch {
    return false;
  }
}
