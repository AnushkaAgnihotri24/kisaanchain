import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { env } from "../config/env";

let startPromise: Promise<void> | null = null;
const importEmbeddedPostgres = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<{ default: typeof import("embedded-postgres").default }>;

function buildAdminDatabaseUrl(databaseName: string) {
  return `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${databaseName}`;
}

async function createEmbeddedPostgresInstance() {
  const { default: EmbeddedPostgres } = await importEmbeddedPostgres("embedded-postgres");
  return new EmbeddedPostgres({
    databaseDir: path.join(env.embeddedPostgresDir, "data"),
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    port: env.POSTGRES_PORT,
    persistent: true,
    onLog: (message: unknown) => console.log(`[embedded-postgres] ${String(message)}`),
    onError: (message: unknown) => console.error(`[embedded-postgres] ${String(message)}`)
  });
}

async function ensureDatabaseExists() {
  const adminPool = new Pool({
    connectionString: buildAdminDatabaseUrl("postgres"),
    max: 1,
    connectionTimeoutMillis: 10000
  });

  try {
    const result = await adminPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [env.POSTGRES_DB]
    );

    if (!result.rows[0]?.exists) {
      await adminPool.query(`create database "${env.POSTGRES_DB}"`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function ensureEmbeddedPostgres() {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    fs.mkdirSync(env.embeddedPostgresDir, { recursive: true });

    const cluster = await createEmbeddedPostgresInstance();
    const pgVersionFile = path.join(env.embeddedPostgresDir, "data", "PG_VERSION");

    if (!fs.existsSync(pgVersionFile)) {
      await cluster.initialise();
    }

    await cluster.start();
    await ensureDatabaseExists();
  })().catch((error) => {
    startPromise = null;
    throw error;
  });

  return startPromise;
}
