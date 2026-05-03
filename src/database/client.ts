import pg from 'pg';
import { getDatabaseConfig } from '../config/database.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (!pool) {
    const config = getDatabaseConfig();

    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    logger.info('Database connection pool created', {
      host: config.host,
      port: config.port,
      database: config.database,
      maxConnections: config.max,
    });
  }

  return pool;
};

export const query = async <T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> => {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Query failed', {
      query: text.substring(0, 100),
      duration,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
};
