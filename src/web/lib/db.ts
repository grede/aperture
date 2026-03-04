import Database from 'better-sqlite3';
import { migrate } from './migrations';
import { ensureWebEnvLoaded } from './env';
import type {
  App,
  Screen,
  ScreenVariant,
  ScreenLocalizedVariant,
  Copy,
  Generation,
  GeneratedScreenshot,
  GenerationConfig,
  DeviceType,
  GenerationStatus,
  AppWithScreens,
  CopiesByScreenAndLocale,
  GenerationWithScreenshots,
  GenerationPreset,
} from '../types';
import { join } from 'path';
import { mkdirSync } from 'fs';

ensureWebEnvLoaded();

const DB_PATH = process.env.DATABASE_PATH || './aperture-data/aperture.db';

function ensureDataDirectory(): void {
  const dataDir = join(process.cwd(), 'aperture-data');
  mkdirSync(dataDir, { recursive: true });
}

function initDatabase(): Database.Database {
  ensureDataDirectory();
  const dbPath = join(process.cwd(), DB_PATH);
  const db = new Database(dbPath);
  migrate(db);
  return db;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function createApp(name: string, description: string): App {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO apps (name, description) VALUES (?, ?)');
  const result = stmt.run(name, description);
  return getAppById(result.lastInsertRowid as number)!;
}

export function getAppById(id: number): App | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM apps WHERE id = ?');
  return (stmt.get(id) as App | undefined) || null;
}

export function getAllApps(): App[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM apps ORDER BY created_at DESC');
  return stmt.all() as App[];
}

export function updateApp(
  id: number,
  updates: { name?: string; description?: string }
): App | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (fields.length === 0) return getAppById(id);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  const stmt = db.prepare(`UPDATE apps SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return getAppById(id);
}

export function deleteApp(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM apps WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getAppWithScreens(id: number): AppWithScreens | null {
  const app = getAppById(id);
  if (!app) return null;
  const screens = getScreensByAppId(id);
  return { ...app, screens };
}

function getNextScreenPosition(appId: number): number {
  const db = getDb();
  const stmt = db.prepare('SELECT MAX(position) as max_pos FROM screens WHERE app_id = ?');
  const result = stmt.get(appId) as { max_pos: number | null };
  return (result.max_pos ?? -1) + 1;
}

type ScreenRow = Omit<Screen, 'variants' | 'localized_variants'>;

function buildFallbackVariant(screen: ScreenRow): ScreenVariant {
  return {
    id: -screen.id,
    screen_id: screen.id,
    device_type: screen.device_type,
    screenshot_path: screen.screenshot_path,
    created_at: screen.created_at,
  };
}

function getScreenVariantsByScreenIds(screenIds: number[]): Map<number, ScreenVariant[]> {
  const variantsByScreenId = new Map<number, ScreenVariant[]>();
  if (screenIds.length === 0) {
    return variantsByScreenId;
  }

  const db = getDb();
  const placeholders = screenIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM screen_variants WHERE screen_id IN (${placeholders}) ORDER BY created_at ASC, id ASC`
  );
  const variants = stmt.all(...screenIds) as ScreenVariant[];
  for (const variant of variants) {
    const existing = variantsByScreenId.get(variant.screen_id) || [];
    existing.push(variant);
    variantsByScreenId.set(variant.screen_id, existing);
  }

  return variantsByScreenId;
}

function getScreenLocalizedVariantsByScreenIds(
  screenIds: number[]
): Map<number, ScreenLocalizedVariant[]> {
  const localizedVariantsByScreenId = new Map<number, ScreenLocalizedVariant[]>();
  if (screenIds.length === 0) {
    return localizedVariantsByScreenId;
  }

  const db = getDb();
  const placeholders = screenIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT *
     FROM screen_localized_variants
     WHERE screen_id IN (${placeholders})
     ORDER BY locale ASC, created_at ASC, id ASC`
  );
  const localizedVariants = stmt.all(...screenIds) as ScreenLocalizedVariant[];
  for (const localizedVariant of localizedVariants) {
    const existing = localizedVariantsByScreenId.get(localizedVariant.screen_id) || [];
    existing.push(localizedVariant);
    localizedVariantsByScreenId.set(localizedVariant.screen_id, existing);
  }

  return localizedVariantsByScreenId;
}

function withScreenVariants(screens: ScreenRow[]): Screen[] {
  const variantsByScreenId = getScreenVariantsByScreenIds(screens.map((screen) => screen.id));
  const localizedVariantsByScreenId = getScreenLocalizedVariantsByScreenIds(
    screens.map((screen) => screen.id)
  );

  return screens.map((screen) => {
    const variants = variantsByScreenId.get(screen.id) || [];
    const resolvedVariants = variants.length > 0 ? variants : [buildFallbackVariant(screen)];

    return {
      ...screen,
      variants: resolvedVariants,
      localized_variants: localizedVariantsByScreenId.get(screen.id) || [],
    };
  });
}

export function createScreen(
  appId: number,
  screenshotPath: string,
  deviceType: DeviceType,
  position?: number
): Screen {
  const db = getDb();
  const pos = position ?? getNextScreenPosition(appId);
  const stmt = db.prepare(
    'INSERT INTO screens (app_id, screenshot_path, device_type, position) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(appId, screenshotPath, deviceType, pos);
  return getScreenById(result.lastInsertRowid as number)!;
}

export function getScreenById(id: number): Screen | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM screens WHERE id = ?');
  const row = stmt.get(id) as ScreenRow | undefined;
  if (!row) return null;
  return withScreenVariants([row])[0];
}

export function getScreensByAppId(appId: number): Screen[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM screens WHERE app_id = ? ORDER BY position ASC');
  const rows = stmt.all(appId) as ScreenRow[];
  return withScreenVariants(rows);
}

export function createScreenVariant(
  screenId: number,
  deviceType: DeviceType,
  screenshotPath: string
): ScreenVariant {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO screen_variants (screen_id, device_type, screenshot_path) VALUES (?, ?, ?)'
  );
  const result = stmt.run(screenId, deviceType, screenshotPath);
  return getScreenVariantById(result.lastInsertRowid as number)!;
}

export function getScreenVariantById(id: number): ScreenVariant | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM screen_variants WHERE id = ?');
  return (stmt.get(id) as ScreenVariant | undefined) || null;
}

export function getScreenVariantsByScreenId(screenId: number): ScreenVariant[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM screen_variants WHERE screen_id = ? ORDER BY created_at ASC, id ASC'
  );
  return stmt.all(screenId) as ScreenVariant[];
}

export function getScreenLocalizedVariantById(id: number): ScreenLocalizedVariant | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM screen_localized_variants WHERE id = ?');
  return (stmt.get(id) as ScreenLocalizedVariant | undefined) || null;
}

export function getScreenLocalizedVariantsByScreenId(screenId: number): ScreenLocalizedVariant[] {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT *
     FROM screen_localized_variants
     WHERE screen_id = ?
     ORDER BY locale ASC, created_at ASC, id ASC`
  );
  return stmt.all(screenId) as ScreenLocalizedVariant[];
}

export function getScreenLocalizedVariantByScreenIdLocaleAndDeviceType(
  screenId: number,
  locale: string,
  deviceType: DeviceType
): ScreenLocalizedVariant | null {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT *
     FROM screen_localized_variants
     WHERE screen_id = ? AND locale = ? AND device_type = ?`
  );
  return (stmt.get(screenId, locale, deviceType) as ScreenLocalizedVariant | undefined) || null;
}

export function upsertScreenLocalizedVariant(
  screenId: number,
  locale: string,
  deviceType: DeviceType,
  screenshotPath: string
): ScreenLocalizedVariant {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO screen_localized_variants (screen_id, locale, device_type, screenshot_path)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(screen_id, locale, device_type) DO UPDATE SET
      screenshot_path = excluded.screenshot_path,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(screenId, locale, deviceType, screenshotPath);
  return getScreenLocalizedVariantByScreenIdLocaleAndDeviceType(screenId, locale, deviceType)!;
}

export function deleteScreenLocalizedVariant(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM screen_localized_variants WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getScreenVariantByScreenIdAndDeviceType(
  screenId: number,
  deviceType: DeviceType
): ScreenVariant | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM screen_variants WHERE screen_id = ? AND device_type = ?');
  return (stmt.get(screenId, deviceType) as ScreenVariant | undefined) || null;
}

export function updateScreen(
  id: number,
  updates: { deviceType?: DeviceType; position?: number }
): Screen | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.deviceType !== undefined) {
    const variant = getScreenVariantByScreenIdAndDeviceType(id, updates.deviceType);
    if (!variant) {
      return null;
    }
    fields.push('device_type = ?', 'screenshot_path = ?');
    values.push(updates.deviceType, variant.screenshot_path);
  }
  if (updates.position !== undefined) {
    fields.push('position = ?');
    values.push(updates.position);
  }
  if (fields.length === 0) return getScreenById(id);
  values.push(id);
  const stmt = db.prepare(`UPDATE screens SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return getScreenById(id);
}

export function deleteScreen(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM screens WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function upsertCopy(
  screenId: number,
  locale: string,
  title: string,
  subtitle: string | null
): Copy {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO copies (screen_id, locale, title, subtitle)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(screen_id, locale) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(screenId, locale, title, subtitle);
  return getCopy(screenId, locale)!;
}

export function getCopy(screenId: number, locale: string): Copy | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM copies WHERE screen_id = ? AND locale = ?');
  return (stmt.get(screenId, locale) as Copy | undefined) || null;
}

export function getCopiesByScreenId(screenId: number): Copy[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM copies WHERE screen_id = ?');
  return stmt.all(screenId) as Copy[];
}

export function getCopiesByAppId(appId: number): CopiesByScreenAndLocale {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT c.* FROM copies c
    JOIN screens s ON c.screen_id = s.id
    WHERE s.app_id = ?
  `);
  const copies = stmt.all(appId) as Copy[];
  const result: CopiesByScreenAndLocale = {};
  for (const copy of copies) {
    if (!result[copy.screen_id]) result[copy.screen_id] = {};
    result[copy.screen_id][copy.locale] = copy;
  }
  return result;
}

export function deleteCopy(screenId: number, locale: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM copies WHERE screen_id = ? AND locale = ?');
  const result = stmt.run(screenId, locale);
  return result.changes > 0;
}

export function deleteCopiesByAppLocale(appId: number, locale: string): number {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM copies
    WHERE locale = ?
      AND screen_id IN (
        SELECT id FROM screens WHERE app_id = ?
      )
  `);
  const result = stmt.run(locale, appId);
  return result.changes;
}

export function createGeneration(appId: number, config: GenerationConfig): Generation {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO generations (app_id, config, status, progress) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(appId, JSON.stringify(config), 'pending', 0);
  return getGenerationById(result.lastInsertRowid as number)!;
}

export function getGenerationById(id: number): Generation | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generations WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return { ...row, config: JSON.parse(row.config) };
}

export function getGenerationsByAppId(appId: number): Generation[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generations WHERE app_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(appId) as any[];
  return rows.map((row) => ({ ...row, config: JSON.parse(row.config) }));
}

export function createOrUpdateGenerationPreset(
  name: string,
  config: GenerationConfig
): GenerationPreset {
  const db = getDb();
  const normalizedName = name.trim();
  const stmt = db.prepare(`
    INSERT INTO generation_presets (name, config)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET
      config = excluded.config,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(normalizedName, JSON.stringify(config));

  const preset = getGenerationPresetByName(normalizedName);
  if (!preset) {
    throw new Error('Failed to save generation preset');
  }
  return preset;
}

export function getGenerationPresetById(id: number): GenerationPreset | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generation_presets WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return { ...row, config: JSON.parse(row.config) };
}

export function getGenerationPresetByName(name: string): GenerationPreset | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generation_presets WHERE name = ?');
  const row = stmt.get(name) as any;
  if (!row) return null;
  return { ...row, config: JSON.parse(row.config) };
}

export function getAllGenerationPresets(): GenerationPreset[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generation_presets ORDER BY updated_at DESC, id DESC');
  const rows = stmt.all() as any[];
  return rows.map((row) => ({ ...row, config: JSON.parse(row.config) }));
}

export function updateGenerationStatus(
  id: number,
  status: GenerationStatus,
  progress: number,
  error?: string
): void {
  const db = getDb();
  const completedAt =
    status === 'completed' || status === 'failed' ? new Date().toISOString() : null;
  const stmt = db.prepare(
    `UPDATE generations SET status = ?, progress = ?, error = ?, completed_at = ? WHERE id = ?`
  );
  stmt.run(status, progress, error || null, completedAt, id);
}

export function updateGenerationProgress(id: number, progress: number): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE generations SET progress = ? WHERE id = ?');
  stmt.run(progress, id);
}

export function getGenerationWithScreenshots(id: number): GenerationWithScreenshots | null {
  const generation = getGenerationById(id);
  if (!generation) return null;
  const screenshots = getGeneratedScreenshotsByGenerationId(id);
  return { ...generation, screenshots };
}

export function createGeneratedScreenshot(
  generationId: number,
  screenId: number,
  locale: string,
  outputPath: string,
  deviceType: DeviceType | null = null
): GeneratedScreenshot {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO generated_screenshots (generation_id, screen_id, locale, device_type, output_path) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(generationId, screenId, locale, deviceType, outputPath);
  return getGeneratedScreenshotById(result.lastInsertRowid as number)!;
}

export function getGeneratedScreenshotById(id: number): GeneratedScreenshot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM generated_screenshots WHERE id = ?');
  return (stmt.get(id) as GeneratedScreenshot | undefined) || null;
}

export function getGeneratedScreenshotsByGenerationId(generationId: number): GeneratedScreenshot[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM generated_screenshots WHERE generation_id = ? ORDER BY created_at ASC'
  );
  return stmt.all(generationId) as GeneratedScreenshot[];
}

export function deleteGeneratedScreenshot(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM generated_screenshots WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export { getDb as db };
