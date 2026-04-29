import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env")
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const repoRoot = path.resolve(process.cwd(), "..");
const host = process.env.POSTGRES_HOST || "127.0.0.1";
const port = Number(process.env.POSTGRES_PORT || 5432);
const user = process.env.POSTGRES_USER || "postgres";
const password = process.env.POSTGRES_PASSWORD || "postgres";
const database = process.env.POSTGRES_DB || "kisaanchain";
const embeddedDir = path.resolve(repoRoot, process.env.EMBEDDED_POSTGRES_DIR || ".local/postgres");
const dataDir = path.join(embeddedDir, "data");

fs.mkdirSync(embeddedDir, { recursive: true });

const cluster = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  onLog: (message) => console.log(`[embedded-postgres] ${String(message)}`),
  onError: (message) => console.error(`[embedded-postgres] ${String(message)}`)
});

if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  await cluster.initialise();
}

await cluster.start();

const pool = new pg.Pool({
  connectionString: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`,
  max: 1
});

try {
  const exists = await pool.query("select exists(select 1 from pg_database where datname = $1) as exists", [database]);
  if (!exists.rows[0]?.exists) {
    await pool.query(`create database "${database}"`);
  }
} finally {
  await pool.end();
}

console.log(`Embedded PostgreSQL ready on postgresql://${host}:${port}/${database}`);

const shutdown = async () => {
  await cluster.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {});
