import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: env.NEON_DATABASE_URL,
  max: 20, // Max 20 connections optimized for Neon serverless pooler
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL Pool Error:', err);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug(`[SQL Query] (${duration}ms) ${text.substring(0, 100)}`);
  return res;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<{ status: string; latencyMs: number; pool: { total: number; idle: number; waiting: number } }> {
  const start = Date.now();
  await pool.query('SELECT 1');
  const latencyMs = Date.now() - start;
  return {
    status: 'connected',
    latencyMs,
    pool: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    }
  };
}

export async function closePool(): Promise<void> {
  logger.info('Closing PostgreSQL connection pool...');
  await pool.end();
  logger.info('PostgreSQL connection pool closed.');
}
