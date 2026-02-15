import type Database from 'better-sqlite3';

/**
 * Database schema version
 */
const SCHEMA_VERSION = 1;

/**
 * Create all database tables
 */
function createTables(db: Database.Database): void {
  // Apps table: Core app entity
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Screens table: Screenshots within an app
  db.exec(`
    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      screenshot_path TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK(device_type IN ('iPhone', 'iPad', 'Android-phone', 'Android-tablet')),
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Copies table: Marketing text per screen per locale
  db.exec(`
    CREATE TABLE IF NOT EXISTS copies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
      UNIQUE(screen_id, locale)
    );
  `);

  // Generations table: Screenshot generation runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      progress INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Generated screenshots table: Output of generation runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generation_id INTEGER NOT NULL,
      screen_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      output_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE
    );
  `);

  // Schema version table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);
}

/**
 * Create indexes for performance
 */
function createIndexes(db: Database.Database): void {
  db.exec('CREATE INDEX IF NOT EXISTS idx_screens_app_id ON screens(app_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_copies_screen_id ON copies(screen_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_copies_locale ON copies(locale);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_generations_app_id ON generations(app_id);');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_generated_screenshots_generation_id ON generated_screenshots(generation_id);'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_generated_screenshots_screen_id ON generated_screenshots(screen_id);'
  );
}

/**
 * Get current schema version
 */
function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Set schema version
 */
function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare('DELETE FROM schema_version').run();
  db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
}

/**
 * Run all migrations
 */
export function migrate(db: Database.Database): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion < SCHEMA_VERSION) {
    console.log(`Migrating database from version ${currentVersion} to ${SCHEMA_VERSION}...`);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Use WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create tables
    createTables(db);

    // Create indexes
    createIndexes(db);

    // Update schema version
    setSchemaVersion(db, SCHEMA_VERSION);

    console.log('Database migration complete.');
  }
}

/**
 * Reset database (for testing)
 */
export function resetDatabase(db: Database.Database): void {
  const tables = [
    'generated_screenshots',
    'generations',
    'copies',
    'screens',
    'apps',
    'schema_version',
  ];

  for (const table of tables) {
    db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  }

  migrate(db);
}
