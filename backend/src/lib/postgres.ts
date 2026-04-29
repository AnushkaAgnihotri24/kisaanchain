import { Pool, type PoolClient, type QueryResult } from "pg";
import { env } from "../config/env";

let pool: Pool | null = null;

function createPool(connectionString = env.DATABASE_URL) {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

export function getPostgresPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function queryPostgres<T = unknown>(text: string, params?: unknown[]) {
  return getPostgresPool().query(text, params);
}

export async function withPgClient<T>(handler: (client: PoolClient) => Promise<T>) {
  const client = await getPostgresPool().connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

export async function verifyPostgresConnection() {
  return withPgClient<QueryResult>((client) => client.query("select current_database(), current_user, version()"));
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
