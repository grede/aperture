/**
 * File storage utilities for uploads and generated images
 */

import { mkdir, writeFile, readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Base directories for file storage
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR || './aperture-data/uploads';
const GENERATIONS_DIR = process.env.GENERATIONS_DIR || './aperture-data/generations';

/**
 * Ensure a directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Save an uploaded screenshot
 * @param appId - App ID
 * @param screenId - Screen ID
 * @param buffer - Image buffer
 * @returns Relative path to saved file
 */
export async function saveUpload(
  appId: number,
  screenId: number,
  buffer: Buffer
): Promise<string> {
  const dir = join(process.cwd(), UPLOADS_DIR, appId.toString());
  await ensureDir(dir);

  const filename = `${screenId}.png`;
  const filePath = join(dir, filename);

  await writeFile(filePath, buffer);

  // Return relative path
  return `${appId}/${filename}`;
}

/**
 * Read an uploaded screenshot
 * @param appId - App ID
 * @param screenId - Screen ID
 * @returns Image buffer
 */
export async function readUpload(
  appId: number,
  screenId: number
): Promise<Buffer> {
  const filePath = join(
    process.cwd(),
    UPLOADS_DIR,
    appId.toString(),
    `${screenId}.png`
  );
  return readFile(filePath);
}

/**
 * Delete an uploaded screenshot
 * @param appId - App ID
 * @param screenId - Screen ID
 */
export async function deleteUpload(
  appId: number,
  screenId: number
): Promise<void> {
  const filePath = join(
    process.cwd(),
    UPLOADS_DIR,
    appId.toString(),
    `${screenId}.png`
  );

  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Delete all uploads for an app
 * @param appId - App ID
 */
export async function deleteAppUploads(appId: number): Promise<void> {
  const dirPath = join(process.cwd(), UPLOADS_DIR, appId.toString());

  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Save a generated screenshot
 * @param generationId - Generation ID
 * @param locale - Locale code
 * @param screenId - Screen ID
 * @param buffer - Image buffer
 * @returns Relative path to saved file
 */
export async function saveGeneration(
  generationId: number,
  locale: string,
  screenId: number,
  buffer: Buffer
): Promise<string> {
  const dir = join(
    process.cwd(),
    GENERATIONS_DIR,
    generationId.toString(),
    locale
  );
  await ensureDir(dir);

  const filename = `${screenId}.png`;
  const filePath = join(dir, filename);

  await writeFile(filePath, buffer);

  // Return relative path
  return `${generationId}/${locale}/${filename}`;
}

/**
 * Read a generated screenshot
 * @param relativePath - Relative path from generations directory
 * @returns Image buffer
 */
export async function readGeneration(relativePath: string): Promise<Buffer> {
  const filePath = join(process.cwd(), GENERATIONS_DIR, relativePath);
  return readFile(filePath);
}

/**
 * Delete a generated screenshot
 * @param relativePath - Relative path from generations directory
 */
export async function deleteGeneration(relativePath: string): Promise<void> {
  const filePath = join(process.cwd(), GENERATIONS_DIR, relativePath);

  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Delete all generated screenshots for a generation
 * @param generationId - Generation ID
 */
export async function deleteGenerationOutputs(
  generationId: number
): Promise<void> {
  const dirPath = join(process.cwd(), GENERATIONS_DIR, generationId.toString());

  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Get absolute path for an upload
 * @param relativePath - Relative path from uploads directory
 * @returns Absolute path
 */
export function getUploadPath(relativePath: string): string {
  return join(process.cwd(), UPLOADS_DIR, relativePath);
}

/**
 * Get absolute path for a generation
 * @param relativePath - Relative path from generations directory
 * @returns Absolute path
 */
export function getGenerationPath(relativePath: string): string {
  return join(process.cwd(), GENERATIONS_DIR, relativePath);
}

/**
 * Check if an upload exists
 * @param appId - App ID
 * @param screenId - Screen ID
 * @returns True if file exists
 */
export function uploadExists(appId: number, screenId: number): boolean {
  const filePath = join(
    process.cwd(),
    UPLOADS_DIR,
    appId.toString(),
    `${screenId}.png`
  );
  return existsSync(filePath);
}

/**
 * Check if a generation exists
 * @param relativePath - Relative path from generations directory
 * @returns True if file exists
 */
export function generationExists(relativePath: string): boolean {
  const filePath = join(process.cwd(), GENERATIONS_DIR, relativePath);
  return existsSync(filePath);
}

/**
 * Initialize storage directories
 */
export async function initializeStorage(): Promise<void> {
  await ensureDir(join(process.cwd(), UPLOADS_DIR));
  await ensureDir(join(process.cwd(), GENERATIONS_DIR));
}
