#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../client.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
  const pool = getPool();

  try {
    logger.info('Starting database migrations');

    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      logger.info('Running migration', { file });

      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await pool.query(sql);

      logger.info('Migration completed', { file });
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
